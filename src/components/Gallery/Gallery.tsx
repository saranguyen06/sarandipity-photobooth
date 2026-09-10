import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
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
            const { data, error } = await supabase
                .from('photos')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false })

            if (cancelled) return
            if (error) setError(error.message)
            else setPhotos(data as Photo[])
            setLoading(false)
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
        const confirmed = window.confirm('Delete this photo? This cannot be undone.')
        if (!confirmed) return

        await supabase.storage.from('photos').remove([photo.storage_path])
        await supabase.from('photos').delete().eq('id', photo.id)
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
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
