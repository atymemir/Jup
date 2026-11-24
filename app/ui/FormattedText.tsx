import { Fragment } from "react";
import { textBlocks } from "../lib/authoring";
function inline(text: string) {
  return text
    .split(/(\*\*[^*\n]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}
export function FormattedText({ value }: { value: string }) {
  return (
    <div className="formattedText">
      {textBlocks(value).map((block, i) =>
        block.kind === "paragraph" ? (
          <div key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </div>
        ) : block.kind === "bullet" ? (
          <ul key={i}>
            {block.lines.map((line, j) => (
              <li key={j}>{inline(line)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} start={block.start}>
            {block.lines.map((line, j) => (
              <li key={j}>{inline(line)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
