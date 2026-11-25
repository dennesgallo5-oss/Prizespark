import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="text-3xl font-semibold text-paper">Page not found</h1>
      <p className="mt-3 text-mist">That page is not part of this development preview.</p>
      <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-electric-300">
        Back to the home page
      </Link>
    </div>
  );
}
