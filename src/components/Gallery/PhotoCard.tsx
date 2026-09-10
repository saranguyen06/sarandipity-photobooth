import { downloadDataUrl } from '../../utils/photoStrip'
import type { Photo } from '../../types'

interface PhotoCardProps {
    photo: Photo
    rotation: string
    onDelete: (photo: Photo) => void
}

export default function PhotoCard({ photo, rotation, onDelete }: PhotoCardProps) {
    function handleDownload() {
        downloadDataUrl(photo.url, `snapshot-booth-${photo.kind}-${photo.id}.jpg`)
    }

    return (
        <figure
            className="photo-card"
            style={{ '--tilt': `${rotation}deg` } as React.CSSProperties}
        >
        <img src={photo.url} alt={`Saved ${photo.kind} capture`} loading="lazy" />
            <figcaption>
                <span>{new Date(photo.created_at).toLocaleDateString()}</span>
                <div className="photo-card__actions">
                    <button onClick={handleDownload} aria-label="Download photo">
                        ↓
                    </button>
                    <button onClick={() => onDelete(photo)} aria-label="Delete photo">
                        x
                    </button>
                </div>
            </figcaption>
        </figure>
    )
}
