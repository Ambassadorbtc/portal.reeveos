/**
 * Step progress indicator — 3 bars with label
 */

const StepIndicator = ({ step, total }) => (
  <div className="flex items-center gap-2 mb-3 sm:mb-5">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
          i + 1 <= step ? 'bg-[#1B4332]' : i + 1 === step + 1 ? 'bg-[#D4A373]' : 'bg-gray-200'
        }`}
      />
    ))}
    <span className="text-xs text-gray-400 ml-1 tabular-nums">
      Step {step} of {total}
    </span>
  </div>
)

export default StepIndicator
