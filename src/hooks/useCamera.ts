import { useEffect, useRef, useState } from 'react'

interface UseCameraOptions {
    facingMode?: 'user' | 'environment'
}

interface UseCameraResult {
    videoRef: React.RefObject<HTMLVideoElement | null>
    ready: boolean
    error: string | null
}

export function useCamera({ facingMode = 'user' }: UseCameraOptions = {}): UseCameraResult {
    // useRef doesn't trigger a re-render when its .current value changes
    // We don't want the component to re-render every time the stream object updates
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function start() {
            setReady(false)
            setError(null)
            try {
                // getUserMedia is asynchronous — the browser shows a permission prompt and waits for the user
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
                    audio: false,
                })
                // Check cancelled to avoid attaching stream to a videoRef.current that's null, or leave a camera track running that nothing is using anymore
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop())
                    return
                }
                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    await videoRef.current.play()
                }
                setReady(true)
            } catch (err) {
                if (!cancelled) {
                    const name = err instanceof DOMException ? err.name : ''
                    setError(
                        name === 'NotAllowedError'
                            ? 'Camera access was denied. Allow camera permissions to use the booth.'
                            : 'Could not access a camera on this device.'
                    )
                }
            }
        }

        start()

        return () => {
            cancelled = true
            streamRef.current?.getTracks().forEach((t) => t.stop())
        }
    }, [facingMode])

    return { videoRef, ready, error }
}
