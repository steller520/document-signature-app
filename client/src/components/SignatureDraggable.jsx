import { useDraggable } from "@dnd-kit/core";

export default function SignatureDraggable() {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "signature",
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab px-4 py-2 bg-blue-500 text-white rounded shadow"
    >
      Drag Signature
    </div>
  );
}