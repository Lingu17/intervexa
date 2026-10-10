"""Generate original path/node vector variants. No external SVG resources."""

from pathlib import Path

root = Path(__file__).resolve().parents[1] / "public"
(root / "brand").mkdir(parents=True, exist_ok=True)
paths = '<path d="M7 6h6l7 10h5M7 26h6l7-10h5M25 6h-5l-7 10H7M25 26h-5l-7-10H7" fill="none" stroke="COLOR" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="12.6" y="12.6" width="6.8" height="6.8" rx="1.7" fill="COLOR" transform="rotate(45 16 16)"/>'
gradient = '<defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#818CF8"/><stop offset="1" stop-color="#C084FC"/></linearGradient></defs>'


def svg(name, color, word=None):
    width = 152 if word else 32
    content = gradient if color == "url(#brand)" else ""
    content += paths.replace("COLOR", color)
    if word:
        content += f'<text x="42" y="23" fill="{word}" font-family="Inter,Arial,sans-serif" font-weight="600" font-size="21" letter-spacing="-.7">Intervexa</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 32" role="img" aria-labelledby="title"><title id="title">{name}</title>{content}</svg>'


for filename, color, word in [
    ("intervexa-mark.svg", "url(#brand)", None),
    ("intervexa-mark-mono.svg", "#94A3B8", None),
    ("intervexa-mark-white.svg", "#F9FAFB", None),
    ("intervexa-logo-dark.svg", "url(#brand)", "#F9FAFB"),
    ("intervexa-logo-light.svg", "url(#brand)", "#10121B"),
    ("intervexa-logo-white.svg", "#F9FAFB", "#F9FAFB"),
]:
    (root / "brand" / filename).write_text(svg("Intervexa", color, word))
(root / "favicon.svg").write_text(svg("Intervexa", "url(#brand)"))
