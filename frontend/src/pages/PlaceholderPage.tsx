type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-slate-600">{description}</p>
    </section>
  );
}
