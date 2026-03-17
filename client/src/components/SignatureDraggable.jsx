import { useDraggable } from "@dnd-kit/react";

export default function SignatureDraggable() {
  const { ref, isDragging } = useDraggable({
    id: "signature",
    feedback: "move",
  });

  return (
    <div
      ref={ref}
      className={`cursor-grab rounded bg-blue-500 px-4 py-2 text-white shadow ${isDragging ? "opacity-60" : "opacity-100"}`}
    >
      Drag Signature
    </div>
  );
}