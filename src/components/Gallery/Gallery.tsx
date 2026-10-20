import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { useAuth } from '../../context/AuthContext'
import { getAwsClients } from '../../lib/awsClients'
import { getConfig } from '../../lib/config'
import PhotoCard from './PhotoCard'
import type { Photo } from '../../types'

export default function Gallery() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { identityId, ddb } = await getAwsClients()
        // Query, not Scan: this only ever asks DynamoDB for items under this
        // user's partition key (their Cognito identity ID). The IAM policy on
        // our Cognito role would reject a query for anyone else's userId
        // anyway (see "Security model" in README.md) — this mirrors that intent.
        const result = await ddb.send(
          new QueryCommand({
            TableName: getConfig().photosTable,
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': identityId },
          })
        )
        if (cancelled) return
        const items = (result.Items ?? []) as Photo[]
        items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setPhotos(items)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load photos.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  // Stable per-photo tilt so the "tossed onto a table" look doesn't
  // reshuffle on every re-render.
  const rotations = useMemo(
    () =>
      Object.fromEntries(
        photos.map((p) => [p.id, (Math.random() * 6 - 3).toFixed(1)])
      ) as Record<string, string>,
    [photos]
  )

  async function handleDelete(photo: Photo) {
    if (!user) return
    const confirmed = window.confirm('Delete this photo? This cannot be undone.')
    if (!confirmed) return

    try {
      const { photosBucket, photosTable } = getConfig()
      const { identityId, s3, ddb } = await getAwsClients()

      await s3.send(new DeleteObjectCommand({ Bucket: photosBucket, Key: photo.storageKey }))
      await ddb.send(
        new DeleteCommand({ TableName: photosTable, Key: { userId: identityId, id: photo.id } })
      )

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete photo.')
    }
  }

  return (
    <div className="gallery-page">
      <div className="gallery-page__header">
        <p className="auth-card__eyebrow">Your keepsakes</p>
        <h1>My Photos</h1>
      </div>

      {loading && <p className="page-loading">Loading your photos…</p>}
      {error && <p className="auth-card__error">{error}</p>}

      {!loading && !error && photos.length === 0 && (
        <div className="gallery-page__empty">
          <p>No photos saved yet. Head to the booth and strike a pose.</p>
          <Link className="btn btn--primary" to="/">
            Open the booth
          </Link>
        </div>
      )}

      <div className="gallery-grid">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            rotation={rotations[photo.id]}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
