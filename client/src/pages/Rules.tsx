import { Link } from "react-router-dom";

export default function Rules() {
  return (
    <div className="flex min-h-screen flex-col items-center p-6">
      <div className="w-full max-w-2xl">
        <Link
          to="/"
          className="mb-8 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          &larr; Back to home
        </Link>

        <h1 className="mb-8 text-4xl font-bold">How to play BS Poker</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">The goal</h2>
          <p className="text-muted-foreground">
            Be the last player standing. Everyone else has to get eliminated
            before you do.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">A round, step by step</h2>
          <ol className="list-decimal space-y-2 pl-6 text-muted-foreground">
            <li>Everyone is dealt some cards. You can only see your own.</li>
            <li>
              On your turn, claim a poker hand that you believe{" "}
              <em>exists somewhere across everyone&apos;s cards combined</em>{" "}
              &mdash; not just your own. For example, &ldquo;a pair of
              kings.&rdquo;
            </li>
            <li>
              Each claim has to be <em>higher</em> than the previous one.
            </li>
            <li>
              Instead of claiming, you can call <strong>BS</strong> on the
              previous player. All cards are revealed.
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  If the claimed hand <em>is</em> in the combined cards, the
                  caller loses the round.
                </li>
                <li>
                  If the claimed hand <em>isn&apos;t</em> in the combined cards, the player who made the claim
                  loses the round.
                </li>
              </ul>
            </li>
            <li>
              Whoever loses the round picks up <strong>one extra card</strong>{" "}
              for the next round.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">How you get out</h2>
          <p className="text-muted-foreground">
            If you ever go over the card limit (set by the host, usually 6),
            you&apos;re eliminated. Last player left wins.
          </p>
        </section>
      </div>
    </div>
  );
}
