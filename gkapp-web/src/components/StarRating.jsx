import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange, size = 24, readOnly = false }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => {
              if (onChange) {
                onChange(star);
                const btn = document.getElementById(`star-${star}`);
                if (btn) {
                  btn.style.animation = 'none';
                  btn.offsetHeight;
                  btn.style.animation = 'v2-star-bounce 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
                }
              }
            }}
            id={`star-${star}`}
            className={`transition-all duration-200 ${
              readOnly ? 'cursor-default' : 'cursor-pointer'
            } focus:outline-none`}
            title={`${star} estrella${star > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              className={`transition-all duration-200 ${
                filled
                  ? 'text-[#e8ac65] fill-[#e8ac65] drop-shadow-[0_0_6px_rgba(232,172,101,0.3)]'
                  : 'text-[#997b66] hover:text-[#baa587]'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
