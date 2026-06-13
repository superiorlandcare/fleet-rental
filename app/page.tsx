export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-widest text-rapid-500">
        Perry, Ohio
      </p>
      <h1 className="font-display mt-3 text-5xl font-700 uppercase sm:text-6xl">
        Superior Landcare <span className="text-rapid-500">LLC</span>
      </h1>
      <p className="mt-4 max-w-xl text-zinc-400">
        Equipment rentals — track loaders, trailers, and attachments with live
        availability, delivery, and instant booking.
      </p>
      <p className="mt-10 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-500">
        Catalog coming online — build in progress.
      </p>
    </main>
  );
}
