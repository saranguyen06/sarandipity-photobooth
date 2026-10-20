import { useState } from 'react'
import { Link } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { useAuth } from '../../context/AuthContext'
import { getAwsClients } from '../../lib/awsClients'
import { getConfig } from '../../lib/config'
import { dataUrlToBlob, downloadDataUrl } from '../../utils/photoStrip'
import type { CaptureKind } from '../../types'

interface ResultPanelProps {
  imageDataUrl: string
  kind: CaptureKind
  onRetake: () => void
}

export default function ResultPanel({ imageDataUrl, kind, onRetake }: ResultPanelProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleDownload() {
    downloadDataUrl(imageDataUrl, `snapshot-booth-${kind}-${Date.now()}.jpg`)
  }

  async function handleShare() {
    try {
      const blob = dataUrlToBlob(imageDataUrl)
      const file = new File([blob], `snapshot-booth-${kind}.jpg`, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Snapshot Booth' })
      } else {
        handleDownload()
      }
    } catch {
      // user cancelled share sheet — no-op
    }
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    try {
      const { photosBucket, photosTable } = getConfig()
      const blob = dataUrlToBlob(imageDataUrl)
      const id = uuidv4()

      const { identityId, s3, ddb } = await getAwsClients()
      // The key MUST start with the caller's Cognito identity ID: that is the
      // value the IAM policy compares against (see "Security model" in README.md). Anything
      // else is denied by AWS itself, not just hidden in the UI.
      const storageKey = `${identityId}/${id}.jpg`

      await s3.send(
        new PutObjectCommand({
          Bucket: photosBucket,
          Key: storageKey,
          Body: blob,
          ContentType: 'image/jpeg',
        })
      )

      await ddb.send(
        new PutCommand({
          TableName: photosTable,
          Item: {
            userId: identityId,
            id,
            storageKey,
            kind,
            createdAt: new Date().toISOString(),
          },
        })
      )

      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this photo. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="result-panel">
      <div className={`result-panel__frame result-panel__frame--${kind}`}>
        <img src={imageDataUrl} alt="Your capture" />
      </div>

      <div className="result-panel__actions">
        <button className="btn btn--primary" onClick={handleDownload}>
          Download
        </button>
        <button className="btn btn--ghost" onClick={handleShare}>
          Share
        </button>

        {user ? (
          <button className="btn btn--ghost" onClick={handleSave} disabled={saving || saved}>
            {saved ? 'Saved to My Photos ✓' : saving ? 'Saving…' : 'Save to My Photos'}
          </button>
        ) : (
          <Link className="btn btn--ghost" to="/login">
            Sign in to save
          </Link>
        )}

        <button className="btn btn--text" onClick={onRetake}>
          Retake
        </button>
      </div>

      {saveError && <p className="auth-card__error">{saveError}</p>}
    </div>
  )
}
