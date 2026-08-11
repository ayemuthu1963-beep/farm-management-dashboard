export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Muthu Farms · Worker Management</p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}
