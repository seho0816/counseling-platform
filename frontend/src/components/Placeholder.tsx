interface Props {
  title: string;
  summary: string;
  items: string[];
  requirementIds: string[];
}

/** 아직 구현하지 않은 화면의 자리. 어떤 요구사항으로 채울지 함께 적어 둔다. */
export default function Placeholder({ title, summary, items, requirementIds }: Props) {
  return (
    <section className="placeholder" aria-label={`${title} (구현 예정)`}>
      <div className="tags">
        <span className="tag tag--plain">구현 예정</span>
      </div>
      <h2>{title}</h2>
      <p>{summary}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="muted">관련 요구사항: {requirementIds.join(', ')}</p>
    </section>
  );
}
