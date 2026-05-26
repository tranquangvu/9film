import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { VideoPlayer } from '@/components/player'
import { movies } from '@/data/movies'

export function WatchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const movie = movies.find(m => String(m.id) === id)

  if (!movie) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center gap-6">
        <p className="text-white/50 text-xl">Movie not found</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      <VideoPlayer movie={movie} onBack={() => navigate(-1)} />
    </div>
  )
}
