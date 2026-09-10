import { useCallback, useRef, useState } from 'react'
import { useCamera } from '../../hooks/useCamera'
import { FILTERS, getFilterById } from '../../utils/filters'
import { captureFrame, composeStrip } from '../../utils/photoStrip'
import ResultPanel from './ResultPanel'
import type { CaptureKind } from '../../types'

const SHOTS_FOR_STRIP = 3

interface CaptureResult {
    imageDataUrl: string
    kind: CaptureKind
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function Booth() {
    const { videoRef, ready, error } = useCamera()
    const [mode, setMode] = useState<CaptureKind>('single')
    const [filterId, setFilterId] = useState('classic')
    const [countdownValue, setCountdownValue] = useState<number | null>(null)
    const [flash, setFlash] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const [shotIndex, setShotIndex] = useState(0)
    const [result, setResult] = useState<CaptureResult | null>(null)
    const framesRef = useRef<string[]>([])

    const filter = getFilterById(filterId)

    const runCountdown = useCallback(async (seconds = 3) => {
        for (let i = seconds; i > 0; i--) {
            setCountdownValue(i)
            await sleep(700)
        }
        setCountdownValue(null)
    }, [])

    const fireFlash = useCallback(async () => {
        setFlash(true)
        await sleep(180)
        setFlash(false)
    }, [])

    async function handleShutter() {
        // makes the shutter button safe to spam-click; a capture already in progress can't be started again
        if (!ready || capturing || !videoRef.current) return
        setCapturing(true)
        // framesRef is a ref, not state; nothing needs to re-render when a frame is pushed into it
        framesRef.current = []

        const shotsNeeded = mode === 'strip' ? SHOTS_FOR_STRIP : 1

        for (let shot = 1; shot <= shotsNeeded; shot++) {
            setShotIndex(shot)
            // runCountdown and fireFlash are useCallback-wrapped small async helpers that each await sleep(ms) in a loop, 
            // updating state as they go
            // (React batches state updates, but awaits between them force each one to render before the next runs)
            await runCountdown(3)
            await fireFlash()
            const { dataUrl } = captureFrame(videoRef.current, filter.css)
            framesRef.current.push(dataUrl)
            if (shot < shotsNeeded) await sleep(500)
        }

        if (mode === 'strip') {
            const stripUrl = await composeStrip(framesRef.current)
            setResult({ imageDataUrl: stripUrl, kind: 'strip' })
        } else {
            setResult({ imageDataUrl: framesRef.current[0], kind: 'single' })
        }

        setShotIndex(0)
        setCapturing(false)
    }

    function handleRetake() {
        setResult(null)
    }

    if (result) {
        return (
            <div className="booth-page">
                <ResultPanel imageDataUrl={result.imageDataUrl} kind={result.kind} onRetake={handleRetake} />
            </div>
        )
    }

    return (
        <div className="booth-page">
            <div className="viewfinder">
                <div className="viewfinder__corner viewfinder__corner--tl" />
                <div className="viewfinder__corner viewfinder__corner--tr" />
                <div className="viewfinder__corner viewfinder__corner--bl" />
                <div className="viewfinder__corner viewfinder__corner--br" />

                    {error ? (
                        <div className="viewfinder__error">{error}</div>
                    ) : (
                        <video
                            ref={videoRef}
                            className="viewfinder__video"
                            style={{ filter: filter.css }}
                            playsInline
                            muted
                        />
                    )}

                    {flash && <div className="viewfinder__flash" />}

                    {countdownValue !== null && (
                        <div className="viewfinder__countdown">{countdownValue}</div>
                    )}

                    {mode === 'strip' && capturing && (
                        <div className="viewfinder__shot-badge">
                            Shot {shotIndex} of {SHOTS_FOR_STRIP}
                        </div>
                    )}

                    {!ready && !error && <div className="viewfinder__loading">Warming up the flashbulb…</div>}
                </div>

                <div className="booth-controls">
                    <div className="mode-toggle" role="group" aria-label="Capture mode">
                    <button
                        className={`mode-toggle__btn ${mode === 'single' ? 'is-active' : ''}`}
                        onClick={() => setMode('single')}
                        disabled={capturing}
                    >
                        Single Shot
                    </button>
                    <button
                        className={`mode-toggle__btn ${mode === 'strip' ? 'is-active' : ''}`}
                        onClick={() => setMode('strip')}
                        disabled={capturing}
                    >
                        Photo Strip (3)
                    </button>
                </div>

                <div className="filter-bar">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            className={`filter-bar__chip ${filterId === f.id ? 'is-active' : ''}`}
                            style={{ filter: f.css }}
                            onClick={() => setFilterId(f.id)}
                            disabled={capturing}
                        >
                            <span className="filter-bar__chip-label" style={{ filter: 'none' }}>
                                {f.label}
                            </span>
                        </button>
                    ))}
                </div>

                <button
                    className="shutter-btn"
                    onClick={handleShutter}
                    disabled={!ready || capturing}
                    aria-label="Take photo"
                >
                    <span className="shutter-btn__ring" />
                </button>
            </div>
        </div>
    )
}
