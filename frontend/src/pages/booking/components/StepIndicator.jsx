/**
 * Run 2: Step 1 of 3 progress indicator
 */

const StepIndicator = ({ step, total }) => (
  <div className="flex items-center gap-2 mb-6">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`h-1.5 flex-1 rounded-full transition-colors ${
          i + 1 <= step ? 'bg-primary' : 'bg-border'
        }`}
      />
    ))}
    <span className="text-xs text-muted ml-2 font-medium">
      Step {step} of {total}
    </span>
  </div>
)

export default StepIndicator
