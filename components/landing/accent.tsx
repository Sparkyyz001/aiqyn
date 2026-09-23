/** Заголовок, который всплывает по словам; последнее слово — курсивом с засечками */
export function Accent({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className={`w ${i === words.length - 1 && words.length > 1 ? "font-serif font-normal tracking-normal italic" : ""}`} style={{ "--i": i } as React.CSSProperties}>
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}
