import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
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
            // Storage upload: puts the actual image bytes into the photos bucket, namespaced under ${user.id}/....
            // path prefix is what the storage RLS policy checks against; why a user can only write into their own folder
            const blob = dataUrlToBlob(imageDataUrl)
            const path = `${user.id}/${Date.now()}-${kind}.jpg`

            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(path, blob, { contentType: 'image/jpeg' })
            if (uploadError) throw uploadError

            // Database insert: a photos table row that records metadata (whose photo it is, what kind, when) and the public URL
            // Gallery can query "all photos where user_id = me" without having to list an entire storage bucket
            const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(path)

            const { error: insertError } = await supabase.from('photos').insert({
                user_id: user.id,
                storage_path: path,
                url: publicUrlData.publicUrl,
                kind,
            })
            if (insertError) throw insertError

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
