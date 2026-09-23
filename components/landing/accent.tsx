/** Заголовок, последнее слово которого набрано курсивом с засечками — акцент в стиле лендинга */
export function Accent({ text }: { text: string }) {
  const i = text.trimEnd().lastIndexOf(" ");
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i + 1)}
      <em className="font-serif font-normal tracking-normal">{text.slice(i + 1)}</em>
    </>
  );
}
