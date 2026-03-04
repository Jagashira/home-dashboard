import Link from "next/link";

export default function HomePage() {
  return (
    <section className="stack-lg">
      <section className="panel hero">
        <p className="eyebrow">MVP</p>
        <h2>Local-only command center for your home stack</h2>
        <p>
          Runs on Raspberry Pi 4 and Mac. Data stays local in SQLite under `./data`.
        </p>
      </section>

      <section className="grid-3">
        <article className="panel">
          <h3>News</h3>
          <p>Fetch RSS feeds, store locally, and browse latest items.</p>
          <Link href="/news">Open News</Link>
        </article>

        <article className="panel">
          <h3>Shop</h3>
          <p>Placeholder for shopping list and planned purchase tracking.</p>
          <Link href="/shop">Open Shop</Link>
        </article>

        <article className="panel">
          <h3>Budget</h3>
          <p>Placeholder for monthly budget tools and household summaries.</p>
          <Link href="/budget">Open Budget</Link>
        </article>
      </section>
    </section>
  );
}
