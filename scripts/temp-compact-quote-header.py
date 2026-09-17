from pathlib import Path

path = Path("app/(app)/quotes/[id]/edit/quote-editor.tsx")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        "interface QuoteEditorProps {\n  quoteId: string;\n  versionId: string;",
        "interface QuoteEditorProps {\n  quoteId: string;\n  projectId: string | null;\n  versionId: string;",
    ),
    (
        "export function QuoteEditor({\n  quoteId,\n  versionId,",
        "export function QuoteEditor({\n  quoteId,\n  projectId,\n  versionId,",
    ),
    (
        '<div className="min-w-0 flex-1 px-6 py-5 xl:max-w-[950px]">',
        '<div className="min-w-0 flex-1 px-6 py-4 xl:max-w-[950px]">',
    ),
    (
        '''<nav className="mb-1 text-[12.5px] text-muted-foreground">\n          <Link href="/projects" className="hover:text-heading">\n            Proiecte\n          </Link>\n          <span className="mx-1.5">›</span>\n          <span className="text-secondary-foreground">\n            {snapshot.projectName ?? "Proiect"}\n          </span>\n        </nav>''',
        '''<nav className="mb-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground">\n          {projectId && (\n            <>\n              <Link\n                href={`/projects/${projectId}`}\n                className="font-medium text-secondary-foreground hover:text-heading"\n              >\n                ← Înapoi la proiect\n              </Link>\n              <span aria-hidden>·</span>\n            </>\n          )}\n          <Link href="/projects" className="hover:text-heading">\n            Proiecte\n          </Link>\n          <span>›</span>\n          <span className="text-secondary-foreground">\n            {snapshot.projectName ?? "Proiect"}\n          </span>\n        </nav>''',
    ),
    (
        '<div className="mt-4 flex gap-1 border-b border-border">',
        '<div className="mt-3 flex gap-1 border-b border-border">',
    ),
    (
        '<aside className="w-full border-t border-border bg-muted-section px-6 py-5 xl:w-[360px] xl:border-l xl:border-t-0">',
        '<aside className="w-full border-t border-border bg-muted-section px-6 py-4 xl:w-[360px] xl:border-l xl:border-t-0">',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one occurrence, found {count}: {old[:100]!r}")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
