"""
Public Website Renderer
=======================
Serves published business websites at /site/{subdomain}/{slug}.
Server-side renders Puck components to HTML with brand theming,
SEO meta tags, structured data, and analytics tracking.
"""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response, RedirectResponse
from database import get_database
from datetime import datetime
import logging
import html as html_lib

logger = logging.getLogger("website_renderer")
router = APIRouter(prefix="/site", tags=["Public Website"])


# ─────────────────────────────────────────────────────
# COMPONENT RENDERERS
# ─────────────────────────────────────────────────────

def _esc(text):
    """HTML-escape a string safely."""
    if not text:
        return ""
    return html_lib.escape(str(text))


def _render_hero_section(props: dict) -> str:
    bg_image = props.get("background_image", "")
    bg_color = props.get("background_color", "var(--brand-primary)")
    headline = _esc(props.get("headline", ""))
    subheadline = _esc(props.get("subheadline", ""))
    cta_text = _esc(props.get("cta_text", ""))
    cta_link = _esc(props.get("cta_link", "#"))
    overlay = props.get("overlay", True)
    text_color = props.get("text_color", "#FFFFFF")

    bg_style = f"background-image:url('{_esc(bg_image)}');background-size:cover;background-position:center;" if bg_image else f"background-color:{_esc(bg_color)};"
    overlay_html = '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.4)"></div>' if overlay and bg_image else ""

    cta_html = f'<a href="{cta_link}" style="display:inline-block;margin-top:1.5rem;padding:0.875rem 2rem;background:var(--brand-accent);color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-family:var(--font-body)">{cta_text}</a>' if cta_text else ""

    return f'''<section style="position:relative;{bg_style}padding:6rem 1.5rem;min-height:500px;display:flex;align-items:center;justify-content:center;text-align:center">
  {overlay_html}
  <div style="position:relative;z-index:1;max-width:800px">
    <h1 style="font-family:var(--font-heading);font-size:3rem;font-weight:700;color:{_esc(text_color)};margin:0 0 1rem">{headline}</h1>
    {f'<p style="font-size:1.25rem;color:{_esc(text_color)};opacity:0.9;margin:0">{subheadline}</p>' if subheadline else ''}
    {cta_html}
  </div>
</section>'''


def _render_heading(props: dict) -> str:
    level = min(max(int(props.get("level", 2)), 1), 6)
    text = _esc(props.get("text", ""))
    align = _esc(props.get("align", "left"))
    color = _esc(props.get("color", "var(--brand-primary)"))
    sizes = {1: "2.5rem", 2: "2rem", 3: "1.75rem", 4: "1.5rem", 5: "1.25rem", 6: "1rem"}
    return f'<h{level} style="font-family:var(--font-heading);font-size:{sizes[level]};color:{color};text-align:{align};padding:1rem 1.5rem;margin:0">{text}</h{level}>'


def _render_text_block(props: dict) -> str:
    content = props.get("content", "")
    align = _esc(props.get("align", "left"))
    # Content may contain HTML from rich text editor — pass through
    return f'<div style="font-family:var(--font-body);font-size:1rem;line-height:1.7;color:#333;text-align:{align};padding:1rem 1.5rem;max-width:800px;margin:0 auto">{content}</div>'


def _render_image_block(props: dict) -> str:
    src = _esc(props.get("src", ""))
    alt = _esc(props.get("alt", ""))
    caption = _esc(props.get("caption", ""))
    width = _esc(props.get("width", "100%"))
    caption_html = f'<figcaption style="text-align:center;font-size:0.875rem;color:#666;margin-top:0.5rem">{caption}</figcaption>' if caption else ""
    return f'<figure style="padding:1rem 1.5rem;margin:0 auto;max-width:1000px"><img src="{src}" alt="{alt}" loading="lazy" style="width:{width};height:auto;border-radius:8px;display:block">{caption_html}</figure>'


def _render_button_block(props: dict) -> str:
    text = _esc(props.get("text", "Click here"))
    link = _esc(props.get("link", "#"))
    variant = props.get("variant", "primary")
    align = _esc(props.get("align", "center"))
    if variant == "secondary":
        bg = "var(--brand-secondary)"
        color = "var(--brand-primary)"
        border = "2px solid var(--brand-primary)"
    elif variant == "outline":
        bg = "transparent"
        color = "var(--brand-primary)"
        border = "2px solid var(--brand-primary)"
    else:
        bg = "var(--brand-accent)"
        color = "#fff"
        border = "none"
    return f'<div style="text-align:{align};padding:1rem 1.5rem"><a href="{link}" style="display:inline-block;padding:0.875rem 2rem;background:{bg};color:{color};border:{border};text-decoration:none;border-radius:6px;font-weight:600;font-family:var(--font-body)">{text}</a></div>'


def _render_service_card(props: dict) -> str:
    name = _esc(props.get("name", ""))
    description = _esc(props.get("description", ""))
    price = _esc(props.get("price", ""))
    duration = _esc(props.get("duration", ""))
    image = _esc(props.get("image", ""))
    img_html = f'<img src="{image}" alt="{name}" loading="lazy" style="width:100%;height:200px;object-fit:cover;border-radius:8px 8px 0 0">' if image else ""
    meta = []
    if duration:
        meta.append(duration)
    if price:
        meta.append(price)
    meta_html = f'<p style="color:var(--brand-accent);font-weight:600;margin:0.5rem 0 0">{" · ".join(meta)}</p>' if meta else ""
    return f'<div style="border:1px solid #eee;border-radius:8px;overflow:hidden;background:#fff">{img_html}<div style="padding:1.25rem"><h3 style="font-family:var(--font-heading);margin:0 0 0.5rem;color:var(--brand-primary)">{name}</h3><p style="font-family:var(--font-body);color:#666;margin:0;font-size:0.9rem">{description}</p>{meta_html}</div></div>'


def _render_service_grid(props: dict) -> str:
    services = props.get("services", [])
    cols = min(int(props.get("columns", 3)), 4)
    cards = "".join(_render_service_card(s) for s in services)
    return f'<section style="padding:3rem 1.5rem;max-width:1200px;margin:0 auto"><div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:1.5rem">{cards}</div></section>'


def _render_team_member(props: dict) -> str:
    name = _esc(props.get("name", ""))
    role = _esc(props.get("role", ""))
    bio = _esc(props.get("bio", ""))
    image = _esc(props.get("image", ""))
    img_html = f'<img src="{image}" alt="{name}" loading="lazy" style="width:120px;height:120px;border-radius:50%;object-fit:cover;margin:0 auto 1rem;display:block">' if image else ""
    return f'<div style="text-align:center;padding:1.5rem">{img_html}<h3 style="font-family:var(--font-heading);margin:0 0 0.25rem;color:var(--brand-primary)">{name}</h3><p style="color:var(--brand-accent);font-weight:500;margin:0 0 0.5rem;font-size:0.9rem">{role}</p><p style="font-family:var(--font-body);color:#666;margin:0;font-size:0.9rem">{bio}</p></div>'


def _render_team_grid(props: dict) -> str:
    members = props.get("members", [])
    cols = min(int(props.get("columns", 3)), 4)
    cards = "".join(_render_team_member(m) for m in members)
    return f'<section style="padding:3rem 1.5rem;max-width:1200px;margin:0 auto"><div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:1.5rem">{cards}</div></section>'


def _render_testimonial(props: dict) -> str:
    quote = _esc(props.get("quote", ""))
    author = _esc(props.get("author", ""))
    role = _esc(props.get("role", ""))
    image = _esc(props.get("image", ""))
    rating = int(props.get("rating", 0))
    stars = "★" * rating + "☆" * (5 - rating) if rating else ""
    img_html = f'<img src="{image}" alt="{author}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;margin-right:1rem">' if image else ""
    return f'''<div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:2rem;max-width:500px">
  {f'<div style="color:var(--brand-accent);font-size:1.25rem;margin-bottom:0.75rem">{stars}</div>' if stars else ''}
  <blockquote style="font-family:var(--font-body);font-size:1rem;color:#333;margin:0 0 1rem;line-height:1.6;font-style:italic">"{quote}"</blockquote>
  <div style="display:flex;align-items:center">{img_html}<div><strong style="font-family:var(--font-heading);color:var(--brand-primary)">{author}</strong>{f'<br><span style="font-size:0.85rem;color:#888">{role}</span>' if role else ''}</div></div>
</div>'''


def _render_testimonials_grid(props: dict) -> str:
    testimonials = props.get("testimonials", [])
    cols = min(int(props.get("columns", 3)), 4)
    cards = "".join(_render_testimonial(t) for t in testimonials)
    return f'<section style="padding:3rem 1.5rem;background:var(--brand-secondary)"><div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat({cols},1fr);gap:1.5rem">{cards}</div></section>'


def _render_spacer(props: dict) -> str:
    height = _esc(props.get("height", "2rem"))
    return f'<div style="height:{height}"></div>'


def _render_divider(props: dict) -> str:
    color = _esc(props.get("color", "#eee"))
    width = _esc(props.get("width", "100%"))
    return f'<hr style="border:none;border-top:1px solid {color};max-width:{width};margin:2rem auto">'


def _render_feature_grid(props: dict) -> str:
    features = props.get("features", props.get("items", []))
    cols = min(int(props.get("columns", 3)), 4)
    cards = ""
    for f in features:
        icon = _esc(f.get("icon", ""))
        title = _esc(f.get("title", ""))
        desc = _esc(f.get("description", ""))
        icon_html = f'<div style="font-size:2rem;margin-bottom:0.75rem">{icon}</div>' if icon else ""
        cards += f'<div style="text-align:center;padding:1.5rem">{icon_html}<h3 style="font-family:var(--font-heading);color:var(--brand-primary);margin:0 0 0.5rem">{title}</h3><p style="font-family:var(--font-body);color:#666;margin:0;font-size:0.9rem">{desc}</p></div>'
    return f'<section style="padding:3rem 1.5rem;max-width:1200px;margin:0 auto"><div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:1.5rem">{cards}</div></section>'


def _render_call_to_action(props: dict) -> str:
    headline = _esc(props.get("headline", ""))
    subheadline = _esc(props.get("subheadline", ""))
    button_text = _esc(props.get("button_text", "Get Started"))
    button_link = _esc(props.get("button_link", "#"))
    bg_color = _esc(props.get("background_color", "var(--brand-primary)"))
    text_color = _esc(props.get("text_color", "#fff"))
    return f'''<section style="background:{bg_color};padding:4rem 1.5rem;text-align:center">
  <div style="max-width:700px;margin:0 auto">
    <h2 style="font-family:var(--font-heading);font-size:2rem;color:{text_color};margin:0 0 0.75rem">{headline}</h2>
    {f'<p style="font-size:1.1rem;color:{text_color};opacity:0.9;margin:0 0 1.5rem">{subheadline}</p>' if subheadline else ''}
    <a href="{button_link}" style="display:inline-block;padding:0.875rem 2rem;background:var(--brand-accent);color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-family:var(--font-body)">{button_text}</a>
  </div>
</section>'''


def _render_image_gallery(props: dict) -> str:
    images = props.get("images", [])
    cols = min(int(props.get("columns", 3)), 4)
    items = ""
    for img in images:
        src = _esc(img.get("src", img.get("url", "")))
        alt = _esc(img.get("alt", ""))
        items += f'<img src="{src}" alt="{alt}" loading="lazy" style="width:100%;height:250px;object-fit:cover;border-radius:8px">'
    return f'<section style="padding:3rem 1.5rem;max-width:1200px;margin:0 auto"><div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:1rem">{items}</div></section>'


def _render_contact_form(props: dict) -> str:
    heading = _esc(props.get("heading", "Get in Touch"))
    email = _esc(props.get("email", ""))
    phone = _esc(props.get("phone", ""))
    address = _esc(props.get("address", ""))
    info_items = ""
    if email:
        info_items += f'<p style="margin:0.5rem 0"><strong>Email:</strong> <a href="mailto:{email}" style="color:var(--brand-accent)">{email}</a></p>'
    if phone:
        info_items += f'<p style="margin:0.5rem 0"><strong>Phone:</strong> <a href="tel:{phone}" style="color:var(--brand-accent)">{phone}</a></p>'
    if address:
        info_items += f'<p style="margin:0.5rem 0"><strong>Address:</strong> {address}</p>'
    return f'''<section style="padding:3rem 1.5rem;max-width:800px;margin:0 auto">
  <h2 style="font-family:var(--font-heading);color:var(--brand-primary);margin:0 0 1.5rem;text-align:center">{heading}</h2>
  <div style="font-family:var(--font-body);color:#333">{info_items}</div>
</section>'''


def _render_pricing_card(props: dict) -> str:
    name = _esc(props.get("name", ""))
    price = _esc(props.get("price", ""))
    period = _esc(props.get("period", ""))
    features = props.get("features", [])
    highlighted = props.get("highlighted", False)
    cta_text = _esc(props.get("cta_text", "Choose"))
    cta_link = _esc(props.get("cta_link", "#"))
    border = "2px solid var(--brand-accent)" if highlighted else "1px solid #eee"
    features_html = "".join(f'<li style="padding:0.4rem 0;border-bottom:1px solid #f5f5f5">{_esc(f)}</li>' for f in features)
    return f'''<div style="border:{border};border-radius:8px;padding:2rem;text-align:center;background:#fff">
  <h3 style="font-family:var(--font-heading);margin:0 0 0.5rem;color:var(--brand-primary)">{name}</h3>
  <div style="font-size:2rem;font-weight:700;color:var(--brand-accent);margin:0.5rem 0">{price}{f'<span style="font-size:0.9rem;font-weight:400;color:#888">/{period}</span>' if period else ''}</div>
  <ul style="list-style:none;padding:0;margin:1rem 0;font-family:var(--font-body);font-size:0.9rem;color:#555">{features_html}</ul>
  <a href="{cta_link}" style="display:inline-block;padding:0.75rem 1.5rem;background:var(--brand-accent);color:#fff;text-decoration:none;border-radius:6px;font-weight:600">{cta_text}</a>
</div>'''


def _render_pricing_grid(props: dict) -> str:
    plans = props.get("plans", [])
    cols = min(len(plans) or 3, 4)
    cards = "".join(_render_pricing_card(p) for p in plans)
    return f'<section style="padding:3rem 1.5rem;max-width:1200px;margin:0 auto"><div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:1.5rem;align-items:start">{cards}</div></section>'


def _render_faq(props: dict) -> str:
    items = props.get("items", props.get("questions", []))
    faq_html = ""
    for item in items:
        q = _esc(item.get("question", ""))
        a = _esc(item.get("answer", ""))
        faq_html += f'<details style="border-bottom:1px solid #eee;padding:1rem 0"><summary style="font-family:var(--font-heading);font-weight:600;color:var(--brand-primary);cursor:pointer">{q}</summary><p style="font-family:var(--font-body);color:#555;margin:0.75rem 0 0;line-height:1.6">{a}</p></details>'
    return f'<section style="padding:3rem 1.5rem;max-width:800px;margin:0 auto">{faq_html}</section>'


def _render_map_embed(props: dict) -> str:
    address = _esc(props.get("address", ""))
    height = _esc(props.get("height", "400"))
    if not address:
        return ""
    query = address.replace(" ", "+")
    return f'<section style="padding:1.5rem"><iframe src="https://maps.google.com/maps?q={query}&output=embed" width="100%" height="{height}" style="border:0;border-radius:8px" loading="lazy" allowfullscreen></iframe></section>'


def _render_video_embed(props: dict) -> str:
    url = _esc(props.get("url", ""))
    if not url:
        return ""
    # Convert YouTube watch URLs to embed
    if "youtube.com/watch" in url:
        vid = url.split("v=")[-1].split("&")[0]
        url = f"https://www.youtube-nocookie.com/embed/{vid}"
    elif "youtu.be/" in url:
        vid = url.split("youtu.be/")[-1].split("?")[0]
        url = f"https://www.youtube-nocookie.com/embed/{vid}"
    return f'<section style="padding:1.5rem;max-width:900px;margin:0 auto"><div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px"><iframe src="{url}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen loading="lazy"></iframe></div></section>'


def _render_social_links(props: dict) -> str:
    links = props.get("links", [])
    align = _esc(props.get("align", "center"))
    items = ""
    for link in links:
        href = _esc(link.get("url", "#"))
        label = _esc(link.get("label", link.get("platform", "")))
        items += f'<a href="{href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 0.5rem;padding:0.5rem 1rem;color:var(--brand-accent);text-decoration:none;font-family:var(--font-body);font-weight:500">{label}</a>'
    return f'<div style="text-align:{align};padding:1rem 1.5rem">{items}</div>'


def _render_logo_cloud(props: dict) -> str:
    logos = props.get("logos", [])
    items = ""
    for logo in logos:
        src = _esc(logo.get("src", logo.get("url", "")))
        alt = _esc(logo.get("alt", ""))
        items += f'<img src="{src}" alt="{alt}" loading="lazy" style="height:40px;object-fit:contain;opacity:0.7">'
    return f'<section style="padding:2rem 1.5rem;max-width:1000px;margin:0 auto"><div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2rem">{items}</div></section>'


def _render_columns(props: dict) -> str:
    columns = props.get("columns", [])
    count = len(columns) or 2
    cols_html = ""
    for col in columns:
        content = col.get("content", "")
        cols_html += f'<div style="flex:1;min-width:250px;padding:1rem">{content}</div>'
    return f'<section style="padding:2rem 1.5rem;max-width:1200px;margin:0 auto"><div style="display:flex;flex-wrap:wrap;gap:1.5rem">{cols_html}</div></section>'


def _render_banner(props: dict) -> str:
    text = _esc(props.get("text", ""))
    bg_color = _esc(props.get("background_color", "var(--brand-accent)"))
    text_color = _esc(props.get("text_color", "#fff"))
    link = _esc(props.get("link", ""))
    inner = f'<a href="{link}" style="color:{text_color};text-decoration:underline">{text}</a>' if link else text
    return f'<div style="background:{bg_color};color:{text_color};text-align:center;padding:1rem 1.5rem;font-family:var(--font-body);font-weight:500">{inner}</div>'


def _render_countdown(props: dict) -> str:
    target_date = _esc(props.get("target_date", ""))
    label = _esc(props.get("label", ""))
    if not target_date:
        return ""
    return f'''<section style="padding:2rem 1.5rem;text-align:center">
  {f'<p style="font-family:var(--font-heading);font-size:1.25rem;color:var(--brand-primary);margin:0 0 0.5rem">{label}</p>' if label else ''}
  <div data-countdown="{target_date}" style="font-size:2rem;font-weight:700;color:var(--brand-accent);font-family:var(--font-body)">
    Loading...
  </div>
  <script>
  (function(){{var el=document.querySelector('[data-countdown="{target_date}"]');if(!el)return;var end=new Date("{target_date}").getTime();setInterval(function(){{var n=end-Date.now();if(n<0){{el.textContent="Ended";return}}var d=Math.floor(n/864e5),h=Math.floor(n%864e5/36e5),m=Math.floor(n%36e5/6e4),s=Math.floor(n%6e4/1e3);el.textContent=d+"d "+h+"h "+m+"m "+s+"s"}},1000)}})();
  </script>
</section>'''


def _render_booking_widget(props: dict) -> str:
    booking_url = _esc(props.get("booking_url", ""))
    button_text = _esc(props.get("button_text", "Book Now"))
    if not booking_url:
        return ""
    return f'<section style="padding:3rem 1.5rem;text-align:center"><a href="{booking_url}" style="display:inline-block;padding:1rem 2.5rem;background:var(--brand-accent);color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:1.1rem;font-family:var(--font-body)">{button_text}</a></section>'


def _render_rich_text(props: dict) -> str:
    html_content = props.get("html", props.get("content", ""))
    return f'<section style="padding:2rem 1.5rem;max-width:800px;margin:0 auto;font-family:var(--font-body);line-height:1.7;color:#333">{html_content}</section>'


def _render_stats(props: dict) -> str:
    stats = props.get("stats", props.get("items", []))
    items_html = ""
    for s in stats:
        value = _esc(s.get("value", ""))
        label = _esc(s.get("label", ""))
        items_html += f'<div style="text-align:center;padding:1rem"><div style="font-size:2.5rem;font-weight:700;color:var(--brand-accent);font-family:var(--font-heading)">{value}</div><div style="font-family:var(--font-body);color:#666;margin-top:0.25rem">{label}</div></div>'
    cols = min(len(stats) or 3, 4)
    return f'<section style="padding:3rem 1.5rem;background:var(--brand-secondary)"><div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat({cols},1fr);gap:1rem">{items_html}</div></section>'


def _render_before_after(props: dict) -> str:
    before = _esc(props.get("before_image", ""))
    after = _esc(props.get("after_image", ""))
    label = _esc(props.get("label", ""))
    return f'''<section style="padding:2rem 1.5rem;max-width:900px;margin:0 auto">
  {f'<h3 style="text-align:center;font-family:var(--font-heading);color:var(--brand-primary);margin:0 0 1rem">{label}</h3>' if label else ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
    <div><p style="text-align:center;font-weight:600;margin:0 0 0.5rem">Before</p><img src="{before}" alt="Before" loading="lazy" style="width:100%;border-radius:8px"></div>
    <div><p style="text-align:center;font-weight:600;margin:0 0 0.5rem">After</p><img src="{after}" alt="After" loading="lazy" style="width:100%;border-radius:8px"></div>
  </div>
</section>'''


def _render_opening_hours(props: dict) -> str:
    hours = props.get("hours", [])
    heading = _esc(props.get("heading", "Opening Hours"))
    rows = ""
    for h in hours:
        day = _esc(h.get("day", ""))
        time_str = _esc(h.get("hours", h.get("time", "")))
        rows += f'<tr><td style="padding:0.5rem 1rem;font-weight:500">{day}</td><td style="padding:0.5rem 1rem;text-align:right">{time_str}</td></tr>'
    return f'''<section style="padding:2rem 1.5rem;max-width:500px;margin:0 auto">
  <h3 style="font-family:var(--font-heading);color:var(--brand-primary);text-align:center;margin:0 0 1rem">{heading}</h3>
  <table style="width:100%;font-family:var(--font-body);color:#333;border-collapse:collapse">{rows}</table>
</section>'''


def _render_generic(props: dict) -> str:
    """Fallback renderer for unknown component types."""
    return ""


# Component type -> renderer mapping
COMPONENT_RENDERERS = {
    "HeroSection": _render_hero_section,
    "Hero": _render_hero_section,
    "Heading": _render_heading,
    "TextBlock": _render_text_block,
    "Text": _render_text_block,
    "ImageBlock": _render_image_block,
    "Image": _render_image_block,
    "ButtonBlock": _render_button_block,
    "Button": _render_button_block,
    "ServiceCard": _render_service_card,
    "ServiceGrid": _render_service_grid,
    "ServiceList": _render_service_grid,
    "TeamMember": _render_team_member,
    "TeamGrid": _render_team_grid,
    "Testimonial": _render_testimonial,
    "Testimonials": _render_testimonials_grid,
    "TestimonialGrid": _render_testimonials_grid,
    "Spacer": _render_spacer,
    "Divider": _render_divider,
    "FeatureGrid": _render_feature_grid,
    "Features": _render_feature_grid,
    "CallToAction": _render_call_to_action,
    "CTA": _render_call_to_action,
    "ImageGallery": _render_image_gallery,
    "Gallery": _render_image_gallery,
    "ContactForm": _render_contact_form,
    "Contact": _render_contact_form,
    "PricingCard": _render_pricing_card,
    "PricingGrid": _render_pricing_grid,
    "Pricing": _render_pricing_grid,
    "FAQ": _render_faq,
    "MapEmbed": _render_map_embed,
    "Map": _render_map_embed,
    "VideoEmbed": _render_video_embed,
    "Video": _render_video_embed,
    "SocialLinks": _render_social_links,
    "LogoCloud": _render_logo_cloud,
    "Columns": _render_columns,
    "Banner": _render_banner,
    "Countdown": _render_countdown,
    "BookingWidget": _render_booking_widget,
    "RichText": _render_rich_text,
    "Stats": _render_stats,
    "Statistics": _render_stats,
    "BeforeAfter": _render_before_after,
    "OpeningHours": _render_opening_hours,
    "Hours": _render_opening_hours,
}


def render_components(puck_data: dict) -> str:
    """Render all components from Puck data to HTML."""
    content = puck_data.get("content", [])
    if not content:
        return ""
    parts = []
    for component in content:
        comp_type = component.get("type", "")
        props = component.get("props", {})
        renderer = COMPONENT_RENDERERS.get(comp_type, _render_generic)
        parts.append(renderer(props))
    return "\n".join(parts)


# ─────────────────────────────────────────────────────
# HTML TEMPLATE
# ─────────────────────────────────────────────────────

def build_page_html(
    page: dict,
    settings: dict,
    subdomain: str,
    slug: str,
    business_id: str,
) -> str:
    """Build a full HTML page from page data and business settings."""
    brand = settings.get("brand", {})
    footer = settings.get("footer", {})
    integrations = settings.get("integrations", {})
    seo = settings.get("seo_defaults", {})
    announcement = settings.get("announcement_bar", {})
    navigation = settings.get("navigation", [])
    booking = settings.get("booking_integration", {})

    page_title = _esc(page.get("title", ""))
    title_suffix = _esc(seo.get("title_suffix", ""))
    full_title = f"{page_title} | {title_suffix}" if title_suffix else page_title
    meta_desc = _esc(page.get("meta_description", ""))
    og_image = _esc(page.get("og_image") or seo.get("default_og_image", ""))
    canonical = f"https://{_esc(subdomain)}.reevenow.com/{_esc(slug)}"

    font_heading = _esc(brand.get("font_heading", "Cormorant Garamond"))
    font_body = _esc(brand.get("font_body", "DM Sans"))
    primary = _esc(brand.get("primary_color", "#111111"))
    secondary = _esc(brand.get("secondary_color", "#F5F0E8"))
    accent = _esc(brand.get("accent_color", "#C4A882"))
    logo_url = _esc(brand.get("logo_url", ""))

    # Integration scripts (deferred until consent)
    ga4_id = _esc(integrations.get("ga4_id", ""))
    meta_pixel = _esc(integrations.get("meta_pixel_id", ""))
    tiktok_pixel = _esc(integrations.get("tiktok_pixel_id", ""))
    has_third_party = bool(ga4_id or meta_pixel or tiktok_pixel)

    # Navigation
    nav_links = ""
    for nav_item in navigation:
        label = _esc(nav_item.get("label", ""))
        href = _esc(nav_item.get("href", nav_item.get("slug", "/")))
        if not href.startswith("http"):
            href = f"/site/{_esc(subdomain)}/{href.lstrip('/')}"
        nav_links += f'<a href="{href}" style="color:{primary};text-decoration:none;font-weight:500;padding:0.5rem 1rem">{label}</a>'

    book_btn = ""
    if booking.get("enabled") and booking.get("booking_url"):
        btn_text = _esc(booking.get("button_text", "Book Now"))
        btn_url = _esc(booking["booking_url"])
        book_btn = f'<a href="{btn_url}" style="display:inline-block;padding:0.5rem 1.25rem;background:{accent};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;margin-left:1rem">{btn_text}</a>'

    logo_html = f'<img src="{logo_url}" alt="{_esc(footer.get("business_name", ""))}" style="height:40px;object-fit:contain">' if logo_url else f'<span style="font-family:var(--font-heading);font-size:1.25rem;font-weight:700;color:{primary}">{_esc(footer.get("business_name", subdomain))}</span>'

    # Announcement bar
    ann_html = ""
    if announcement.get("enabled") and announcement.get("text"):
        ann_bg = _esc(announcement.get("bg_color", "#111111"))
        ann_color = _esc(announcement.get("text_color", "#FFFFFF"))
        ann_text = _esc(announcement["text"])
        ann_link = _esc(announcement.get("link", ""))
        inner = f'<a href="{ann_link}" style="color:{ann_color};text-decoration:underline">{ann_text}</a>' if ann_link else ann_text
        ann_html = f'<div style="background:{ann_bg};color:{ann_color};text-align:center;padding:0.625rem 1rem;font-family:var(--font-body);font-size:0.875rem">{inner}</div>'

    # Cookie consent banner
    consent_html = ""
    if has_third_party:
        consent_html = f'''<div id="rn-cookie-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #ddd;padding:1rem 1.5rem;z-index:9999;font-family:var(--font-body);font-size:0.9rem">
  <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
    <p style="margin:0;color:#333;flex:1">We use cookies to analyse traffic and improve your experience. Our own analytics are cookie-free.</p>
    <div>
      <button onclick="rnConsent(false)" style="padding:0.5rem 1rem;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;margin-right:0.5rem;font-family:var(--font-body)">Reject</button>
      <button onclick="rnConsent(true)" style="padding:0.5rem 1rem;border:none;background:{accent};color:#fff;border-radius:4px;cursor:pointer;font-family:var(--font-body)">Accept</button>
    </div>
  </div>
</div>
<script>
(function(){{
  if(sessionStorage.getItem('rn_consent')!==null){{
    if(sessionStorage.getItem('rn_consent')==='true')rnLoadThirdParty();
    return;
  }}
  document.getElementById('rn-cookie-banner').style.display='block';
}})();
function rnConsent(accepted){{
  sessionStorage.setItem('rn_consent',accepted?'true':'false');
  document.getElementById('rn-cookie-banner').style.display='none';
  if(accepted)rnLoadThirdParty();
}}
function rnLoadThirdParty(){{
  {_ga4_loader(ga4_id) if ga4_id else ''}
  {_meta_pixel_loader(meta_pixel) if meta_pixel else ''}
  {_tiktok_loader(tiktok_pixel) if tiktok_pixel else ''}
}}
</script>'''

    # Page content
    puck_data = page.get("puck_data", {})
    content_html = render_components(puck_data)

    # Footer
    footer_biz = _esc(footer.get("business_name", ""))
    footer_tagline = _esc(footer.get("tagline", ""))
    footer_address = _esc(footer.get("address", ""))
    footer_phone = _esc(footer.get("phone", ""))
    footer_email = _esc(footer.get("email", ""))
    social = footer.get("social", {})
    social_links = ""
    for platform, url in social.items():
        if url:
            social_links += f'<a href="{_esc(url)}" target="_blank" rel="noopener noreferrer" style="color:{accent};text-decoration:none;margin:0 0.5rem">{_esc(platform.title())}</a>'
    footer_links_list = footer.get("links", [])
    footer_nav = ""
    for fl in footer_links_list:
        fl_label = _esc(fl.get("label", ""))
        fl_href = _esc(fl.get("href", "/"))
        footer_nav += f'<a href="{fl_href}" style="color:#999;text-decoration:none;margin:0 0.75rem">{fl_label}</a>'

    # WhatsApp floating button
    wa_html = ""
    wa_number = integrations.get("whatsapp_number", "")
    if wa_number:
        wa_clean = _esc(wa_number.replace(" ", "").replace("+", "").replace("-", ""))
        wa_html = f'<a href="https://wa.me/{wa_clean}" target="_blank" rel="noopener noreferrer" style="position:fixed;bottom:1.5rem;right:1.5rem;z-index:9998;width:56px;height:56px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2)" aria-label="WhatsApp"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.597-1.47A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.168 0-4.19-.583-5.935-1.601l-.425-.254-2.727.872.87-2.644-.278-.44A9.793 9.793 0 012.182 12c0-5.423 4.395-9.818 9.818-9.818S21.818 6.577 21.818 12s-4.395 9.818-9.818 9.818z"/></svg></a>'

    # JSON-LD
    jsonld = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": footer.get("business_name", ""),
        "url": f"https://{subdomain}.reevenow.com",
    }
    if footer.get("address"):
        jsonld["address"] = footer["address"]
    if footer.get("phone"):
        jsonld["telephone"] = footer["phone"]
    if footer.get("email"):
        jsonld["email"] = footer["email"]

    import json
    jsonld_str = json.dumps(jsonld)

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{full_title}</title>
  <meta name="description" content="{meta_desc}">
  <meta property="og:title" content="{page_title}">
  <meta property="og:description" content="{meta_desc}">
  <meta property="og:image" content="{og_image}">
  <meta property="og:url" content="{canonical}">
  <link rel="canonical" href="{canonical}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@400;600;700&family={font_body.replace(' ', '+')}:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {{
      --brand-primary: {primary};
      --brand-secondary: {secondary};
      --brand-accent: {accent};
      --font-heading: '{font_heading}', serif;
      --font-body: '{font_body}', sans-serif;
    }}
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: var(--font-body); color: #333; background: #fff; -webkit-font-smoothing: antialiased; }}
    img {{ max-width: 100%; }}
    a {{ transition: opacity 0.15s; }}
    a:hover {{ opacity: 0.85; }}
    @media (max-width: 768px) {{
      section div[style*="grid-template-columns"] {{ grid-template-columns: 1fr !important; }}
      h1 {{ font-size: 2rem !important; }}
    }}
  </style>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="/site-assets/tracker.js" data-business="{_esc(business_id)}" data-page="{_esc(slug)}" async></script>
  <script src="/site-assets/cookie-consent.js" data-ga4="{_esc(ga4_id)}" data-meta="{_esc(meta_pixel)}" data-tiktok="{_esc(tiktok_pixel)}" async></script>
  <script type="application/ld+json">{jsonld_str}</script>
</head>
<body>
  {ann_html}
  {consent_html}
  <nav style="display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;border-bottom:1px solid #eee;background:#fff;position:sticky;top:0;z-index:100">
    <a href="/site/{_esc(subdomain)}" style="text-decoration:none">{logo_html}</a>
    <div style="display:flex;align-items:center">{nav_links}{book_btn}</div>
  </nav>
  <main>{content_html}</main>
  <footer style="background:var(--brand-primary);color:#fff;padding:3rem 2rem;margin-top:2rem">
    <div style="max-width:1200px;margin:0 auto;text-align:center">
      <h3 style="font-family:var(--font-heading);font-size:1.5rem;margin:0 0 0.5rem">{footer_biz}</h3>
      {f'<p style="opacity:0.8;margin:0 0 1rem">{footer_tagline}</p>' if footer_tagline else ''}
      <div style="font-size:0.9rem;opacity:0.7;margin-bottom:1rem">
        {f'{footer_address}<br>' if footer_address else ''}
        {f'{footer_phone} · ' if footer_phone else ''}{f'<a href="mailto:{footer_email}" style="color:#fff">{footer_email}</a>' if footer_email else ''}
      </div>
      {f'<div style="margin-bottom:1rem">{social_links}</div>' if social_links else ''}
      {f'<div style="margin-bottom:1rem">{footer_nav}</div>' if footer_nav else ''}
      <p style="font-size:0.8rem;opacity:0.5;margin:0">&copy; {datetime.utcnow().year} {footer_biz}. All rights reserved.</p>
    </div>
  </footer>
  {wa_html}
</body>
</html>'''


def _ga4_loader(ga4_id: str) -> str:
    return f'''var gs=document.createElement('script');gs.src='https://www.googletagmanager.com/gtag/js?id={ga4_id}';gs.async=true;document.head.appendChild(gs);
  window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','{ga4_id}');'''


def _meta_pixel_loader(pixel_id: str) -> str:
    return f'''!function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init','{pixel_id}');fbq('track','PageView');'''


def _tiktok_loader(pixel_id: str) -> str:
    return f'''!function(w,d,t){{w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){{t[e]=function(){{t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){{for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e}};ttq.load=function(e,n){{var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{{}};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{{}};ttq._t[e]=+new Date;ttq._o=ttq._o||{{}};ttq._o[e]=n||{{}};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)}};
  ttq.load('{pixel_id}');ttq.page();}}(window,document,'ttq');'''


def build_maintenance_html(settings: dict, subdomain: str) -> str:
    """Build maintenance mode or coming soon page."""
    brand = settings.get("brand", {})
    maintenance = settings.get("maintenance_mode", {})
    footer = settings.get("footer", {})
    message = _esc(maintenance.get("message", "We'll be back soon."))
    biz_name = _esc(footer.get("business_name", subdomain))
    primary = _esc(brand.get("primary_color", "#111111"))
    accent = _esc(brand.get("accent_color", "#C4A882"))
    font_heading = _esc(brand.get("font_heading", "Cormorant Garamond"))
    font_body = _esc(brand.get("font_body", "DM Sans"))
    logo = _esc(brand.get("logo", ""))
    mode_type = maintenance.get("type", "maintenance")  # maintenance | coming_soon
    launch_date = maintenance.get("launch_date", "")
    social = footer.get("social", {})

    social_links = ""
    social_map = {"instagram": "Instagram", "facebook": "Facebook", "tiktok": "TikTok"}
    for key, label in social_map.items():
        url = social.get(key, "")
        if url:
            social_links += f'<a href="{_esc(url)}" target="_blank" rel="noopener" style="color:{primary};text-decoration:none;margin:0 8px;font-size:0.9rem">{label}</a>'

    logo_html = f'<img src="{logo}" alt="{biz_name}" style="max-width:180px;max-height:80px;margin-bottom:1.5rem">' if logo else ""

    if mode_type == "coming_soon":
        countdown_js = ""
        if launch_date:
            countdown_js = f'''<div id="countdown" style="display:flex;gap:1rem;justify-content:center;margin:1.5rem 0;font-family:'{font_body}',sans-serif"></div>
<script>
(function(){{
  var target=new Date("{_esc(launch_date)}").getTime();
  function update(){{
    var now=Date.now(),d=target-now;
    if(d<0){{document.getElementById("countdown").innerHTML="<p>We're live!</p>";return;}}
    var days=Math.floor(d/864e5),hrs=Math.floor(d%864e5/36e5),mins=Math.floor(d%36e5/6e4),secs=Math.floor(d%6e4/1e3);
    document.getElementById("countdown").innerHTML=
      '<div style="text-align:center"><div style="font-size:2rem;font-weight:700;color:{primary}">'+days+'</div><div style="font-size:0.75rem;color:#999">DAYS</div></div>'+
      '<div style="text-align:center"><div style="font-size:2rem;font-weight:700;color:{primary}">'+hrs+'</div><div style="font-size:0.75rem;color:#999">HOURS</div></div>'+
      '<div style="text-align:center"><div style="font-size:2rem;font-weight:700;color:{primary}">'+mins+'</div><div style="font-size:0.75rem;color:#999">MINS</div></div>'+
      '<div style="text-align:center"><div style="font-size:2rem;font-weight:700;color:{primary}">'+secs+'</div><div style="font-size:0.75rem;color:#999">SECS</div></div>';
  }}
  update();setInterval(update,1000);
}})();
</script>'''

        email_form = f'''<form id="notify-form" style="display:flex;gap:8px;max-width:400px;margin:1.5rem auto 0;flex-wrap:wrap;justify-content:center">
  <input type="email" placeholder="Enter your email" required style="flex:1;min-width:200px;padding:10px 14px;border:1px solid #ddd;border-radius:6px;font-family:'{font_body}',sans-serif;font-size:0.9rem;outline:none">
  <button type="submit" style="padding:10px 20px;background:{accent};color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-family:'{font_body}',sans-serif">Notify Me</button>
</form>
<p id="notify-msg" style="font-size:0.85rem;color:#999;margin-top:8px"></p>
<script>
document.getElementById("notify-form").addEventListener("submit",function(e){{
  e.preventDefault();
  var email=this.querySelector("input").value;
  fetch("/forms/{settings.get('business_id','')}/contact",{{method:"POST",headers:{{"Content-Type":"application/json"}},body:JSON.stringify({{name:"Coming Soon Signup",email:email,message:"Wants to be notified when site launches"}})}}
  ).then(function(){{document.getElementById("notify-msg").textContent="Thanks! We'll notify you when we launch.";document.getElementById("notify-form").reset();}}).catch(function(){{document.getElementById("notify-msg").textContent="Something went wrong. Please try again.";}});
}});
</script>'''

        return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{biz_name} — Coming Soon</title>
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@700&family={font_body.replace(' ', '+')}:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {{ margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;font-family:'{font_body}',sans-serif;color:#333; }}
    .wrap {{ text-align:center;padding:2rem;max-width:600px; }}
    h1 {{ font-family:'{font_heading}',serif;color:{primary};font-size:2.5rem;margin:0 0 0.75rem; }}
    p {{ font-size:1.1rem;opacity:0.7;margin:0 0 0.5rem; }}
  </style>
</head>
<body>
  <div class="wrap">
    {logo_html}
    <h1>{biz_name}</h1>
    <p>{message}</p>
    {countdown_js}
    {email_form}
    {f'<div style="margin-top:2rem">{social_links}</div>' if social_links else ''}
  </div>
</body>
</html>'''

    # Default maintenance mode
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{biz_name} — Maintenance</title>
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@700&family={font_body.replace(' ', '+')}:wght@400&display=swap" rel="stylesheet">
  <style>
    body {{ margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;font-family:'{font_body}',sans-serif;color:#333; }}
    .wrap {{ text-align:center;padding:2rem; }}
    h1 {{ font-family:'{font_heading}',serif;color:{primary};font-size:2rem;margin:0 0 1rem; }}
    p {{ font-size:1.1rem;opacity:0.7; }}
  </style>
</head>
<body><div class="wrap">{logo_html}<h1>{biz_name}</h1><p>{message}</p></div></body>
</html>'''


def build_404_html(settings: dict, subdomain: str) -> str:
    """Build branded 404 page."""
    brand = settings.get("brand", {})
    footer = settings.get("footer", {})
    navigation = settings.get("navigation", [])
    biz_name = _esc(footer.get("business_name", subdomain))
    primary = _esc(brand.get("primary_color", "#111111"))
    accent = _esc(brand.get("accent_color", "#C4A882"))
    font_heading = _esc(brand.get("font_heading", "Cormorant Garamond"))
    font_body = _esc(brand.get("font_body", "DM Sans"))

    nav_links = ""
    for nav_item in navigation:
        label = _esc(nav_item.get("label", ""))
        href = _esc(nav_item.get("href", nav_item.get("slug", "/")))
        if not href.startswith("http"):
            href = f"/site/{_esc(subdomain)}/{href.lstrip('/')}"
        nav_links += f'<a href="{href}" style="color:{accent};text-decoration:none;margin:0 0.75rem">{label}</a>'

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found | {biz_name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@700&family={font_body.replace(' ', '+')}:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body {{ margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;font-family:'{font_body}',sans-serif;color:#333; }}
    .wrap {{ text-align:center;padding:2rem; }}
    h1 {{ font-family:'{font_heading}',serif;color:{primary};font-size:4rem;margin:0; }}
    h2 {{ font-family:'{font_heading}',serif;color:{primary};font-size:1.5rem;margin:0.5rem 0 1rem; }}
    p {{ margin:0 0 1.5rem;opacity:0.7; }}
    .nav {{ margin-top:1rem; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a href="/site/{_esc(subdomain)}" style="display:inline-block;padding:0.75rem 1.5rem;background:{accent};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Back to Home</a>
    {f'<div class="nav" style="margin-top:1.5rem">{nav_links}</div>' if nav_links else ''}
  </div>
</body>
</html>'''


# ─────────────────────────────────────────────────────
# PUBLIC ROUTES
# ─────────────────────────────────────────────────────

async def _get_settings_by_subdomain(subdomain: str):
    """Lookup website settings by subdomain."""
    db = get_database()
    return await db.website_settings.find_one({"subdomain": subdomain})


async def _check_redirect(business_id: str, slug: str):
    """Check if there's a redirect rule for this path."""
    db = get_database()
    redirect = await db.website_redirects.find_one({
        "business_id": business_id,
        "from_path": f"/{slug}",
    })
    return redirect


@router.get("/{subdomain}/sitemap.xml")
async def sitemap(subdomain: str):
    """Auto-generated XML sitemap for a business website."""
    settings = await _get_settings_by_subdomain(subdomain)
    if not settings:
        return Response(content="Not found", status_code=404)

    db = get_database()
    business_id = settings["business_id"]
    pages = await db.website_pages.find(
        {"business_id": business_id, "status": "published", "deleted": {"$ne": True}},
        {"slug": 1, "published_at": 1},
    ).to_list(500)

    urls = ""
    for page in pages:
        slug = _esc(page.get("slug", ""))
        published = page.get("published_at")
        lastmod = published.strftime("%Y-%m-%d") if published else datetime.utcnow().strftime("%Y-%m-%d")
        loc = f"https://{_esc(subdomain)}.reevenow.com/{slug}"
        urls += f"  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod></url>\n"

    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{urls}</urlset>'''

    return Response(content=xml, media_type="application/xml")


@router.get("/{subdomain}/robots.txt")
async def robots(subdomain: str):
    """Robots.txt for a business website."""
    content = f"""User-agent: *
Allow: /

Sitemap: https://{subdomain}.reevenow.com/sitemap.xml
"""
    return Response(content=content, media_type="text/plain")


@router.get("/{subdomain}")
@router.get("/{subdomain}/{slug}")
async def render_page(subdomain: str, slug: str = "home"):
    """Public page renderer — serves a published website page as HTML."""
    settings = await _get_settings_by_subdomain(subdomain)
    if not settings:
        return HTMLResponse(
            content="<html><body><h1>Site not found</h1></body></html>",
            status_code=404,
        )

    business_id = settings["business_id"]

    # Check maintenance mode
    maintenance = settings.get("maintenance_mode", {})
    if maintenance.get("enabled"):
        return HTMLResponse(content=build_maintenance_html(settings, subdomain))

    # Check redirects
    redirect = await _check_redirect(business_id, slug)
    if redirect:
        status_code = 301 if redirect.get("type") == "301" else 302
        to_path = redirect.get("to_path", "/")
        if not to_path.startswith("http"):
            to_path = f"/site/{subdomain}/{to_path.lstrip('/')}"
        return RedirectResponse(url=to_path, status_code=status_code)

    # Find published page
    db = get_database()
    page = await db.website_pages.find_one({
        "business_id": business_id,
        "slug": slug,
        "status": "published",
        "deleted": {"$ne": True},
    })

    if not page:
        return HTMLResponse(
            content=build_404_html(settings, subdomain),
            status_code=404,
        )

    html = build_page_html(page, settings, subdomain, slug, business_id)
    return HTMLResponse(content=html)


# ─────────────────────────────────────────────────────
# PUBLIC BLOG ROUTES
# ─────────────────────────────────────────────────────

def _blog_card_html(post: dict, subdomain: str) -> str:
    """Render a single blog post card."""
    title = _esc(post.get("title", "Untitled"))
    excerpt = _esc(post.get("excerpt", ""))[:200]
    slug = _esc(post.get("slug", ""))
    image = post.get("featured_image", "")
    date = post.get("published_at") or post.get("created_at")
    date_str = date.strftime("%B %d, %Y") if date else ""
    tags = post.get("tags", [])
    tag_html = "".join(f'<span style="display:inline-block;background:var(--brand-secondary);color:var(--brand-primary);padding:2px 8px;border-radius:4px;font-size:0.75rem;margin-right:4px">{_esc(t)}</span>' for t in tags[:3])
    img_html = f'<img src="{_esc(image)}" alt="{title}" style="width:100%;height:200px;object-fit:cover;border-radius:8px 8px 0 0" loading="lazy">' if image else ""

    return f'''<article style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;background:#fff;transition:box-shadow 0.2s">
  {img_html}
  <div style="padding:1.25rem">
    {f'<div style="margin-bottom:8px">{tag_html}</div>' if tag_html else ''}
    <h2 style="margin:0 0 8px;font-family:var(--font-heading);font-size:1.25rem"><a href="/site/{_esc(subdomain)}/blog/{slug}" style="color:var(--brand-primary);text-decoration:none">{title}</a></h2>
    {f'<p style="margin:0 0 8px;color:#666;font-size:0.9rem">{excerpt}</p>' if excerpt else ''}
    <time style="font-size:0.8rem;color:#999">{date_str}</time>
  </div>
</article>'''


@router.get("/{subdomain}/blog")
async def blog_listing(subdomain: str):
    """Public blog listing page."""
    settings = await _get_settings_by_subdomain(subdomain)
    if not settings:
        return HTMLResponse(content="<html><body><h1>Site not found</h1></body></html>", status_code=404)

    business_id = settings["business_id"]
    maintenance = settings.get("maintenance_mode", {})
    if maintenance.get("enabled"):
        return HTMLResponse(content=build_maintenance_html(settings, subdomain))

    db = get_database()
    posts = await db.blog_posts.find({
        "business_id": business_id,
        "status": "published",
        "deleted": {"$ne": True},
    }).sort("published_at", -1).limit(50).to_list(50)

    brand = settings.get("brand", {})
    footer = settings.get("footer", {})
    biz_name = _esc(footer.get("business_name", subdomain))
    primary = _esc(brand.get("primary_color", "#111111"))
    secondary = _esc(brand.get("secondary_color", "#FAFAFA"))
    font_heading = _esc(brand.get("font_heading", "Cormorant Garamond"))
    font_body = _esc(brand.get("font_body", "DM Sans"))

    cards = "".join(_blog_card_html(p, subdomain) for p in posts)
    empty = '<p style="text-align:center;color:#999;padding:3rem 0">No blog posts yet.</p>' if not posts else ""

    return HTMLResponse(content=f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog — {biz_name}</title>
  <link rel="alternate" type="application/rss+xml" title="{biz_name} Blog" href="/site/{_esc(subdomain)}/blog/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@400;700&family={font_body.replace(' ', '+')}:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {{ --brand-primary: {primary}; --brand-secondary: {secondary}; --font-heading: '{font_heading}', serif; --font-body: '{font_body}', sans-serif; }}
    body {{ margin:0;font-family:var(--font-body);color:#333;background:#fafafa; }}
    a {{ color: var(--brand-primary); }}
  </style>
</head>
<body>
  <header style="background:var(--brand-primary);color:#fff;padding:2rem 1.5rem;text-align:center">
    <h1 style="margin:0;font-family:var(--font-heading);font-size:2.5rem">{biz_name} Blog</h1>
    <nav style="margin-top:1rem"><a href="/site/{_esc(subdomain)}" style="color:#fff;opacity:0.8;text-decoration:none;font-size:0.9rem">← Back to website</a></nav>
  </header>
  <main style="max-width:900px;margin:0 auto;padding:2rem 1.5rem">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem">
      {cards}
    </div>
    {empty}
  </main>
</body>
</html>''')


@router.get("/{subdomain}/blog/feed.xml")
async def blog_rss_feed(subdomain: str):
    """RSS feed for the blog."""
    settings = await _get_settings_by_subdomain(subdomain)
    if not settings:
        return Response(content="Not found", status_code=404, media_type="text/plain")

    business_id = settings["business_id"]
    db = get_database()
    posts = await db.blog_posts.find({
        "business_id": business_id,
        "status": "published",
        "deleted": {"$ne": True},
    }).sort("published_at", -1).limit(20).to_list(20)

    footer = settings.get("footer", {})
    biz_name = _esc(footer.get("business_name", subdomain))
    base_url = f"https://{subdomain}.reevenow.com"

    items = ""
    for post in posts:
        title = _esc(post.get("title", ""))
        slug = _esc(post.get("slug", ""))
        excerpt = _esc(post.get("excerpt", ""))
        pub_date = (post.get("published_at") or post.get("created_at", datetime.utcnow()))
        rfc_date = pub_date.strftime("%a, %d %b %Y %H:%M:%S +0000")
        items += f"""<item>
  <title>{title}</title>
  <link>{base_url}/blog/{slug}</link>
  <guid isPermaLink="true">{base_url}/blog/{slug}</guid>
  <description>{excerpt}</description>
  <pubDate>{rfc_date}</pubDate>
</item>
"""

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>{biz_name} Blog</title>
  <link>{base_url}/blog</link>
  <description>Latest posts from {biz_name}</description>
  <atom:link href="{base_url}/blog/feed.xml" rel="self" type="application/rss+xml"/>
  {items}
</channel>
</rss>"""

    return Response(content=rss, media_type="application/rss+xml")


@router.get("/{subdomain}/blog/{post_slug}")
async def blog_single_post(subdomain: str, post_slug: str):
    """Public single blog post page."""
    settings = await _get_settings_by_subdomain(subdomain)
    if not settings:
        return HTMLResponse(content="<html><body><h1>Site not found</h1></body></html>", status_code=404)

    business_id = settings["business_id"]
    maintenance = settings.get("maintenance_mode", {})
    if maintenance.get("enabled"):
        return HTMLResponse(content=build_maintenance_html(settings, subdomain))

    db = get_database()
    post = await db.blog_posts.find_one({
        "business_id": business_id,
        "slug": post_slug,
        "status": "published",
        "deleted": {"$ne": True},
    })

    if not post:
        return HTMLResponse(content=build_404_html(settings, subdomain), status_code=404)

    brand = settings.get("brand", {})
    footer = settings.get("footer", {})
    biz_name = _esc(footer.get("business_name", subdomain))
    primary = _esc(brand.get("primary_color", "#111111"))
    secondary = _esc(brand.get("secondary_color", "#FAFAFA"))
    font_heading = _esc(brand.get("font_heading", "Cormorant Garamond"))
    font_body = _esc(brand.get("font_body", "DM Sans"))

    title = _esc(post.get("title", ""))
    content = post.get("content", "")  # HTML content — already safe from editor
    featured_image = post.get("featured_image", "")
    meta_desc = _esc(post.get("meta_description", post.get("excerpt", "")[:160]))
    pub_date = post.get("published_at") or post.get("created_at")
    date_str = pub_date.strftime("%B %d, %Y") if pub_date else ""
    tags = post.get("tags", [])
    tag_html = "".join(f'<span style="display:inline-block;background:{secondary};color:{primary};padding:4px 12px;border-radius:4px;font-size:0.8rem;margin-right:6px">{_esc(t)}</span>' for t in tags)
    img_html = f'<img src="{_esc(featured_image)}" alt="{title}" style="width:100%;max-height:400px;object-fit:cover;border-radius:8px;margin-bottom:2rem" loading="lazy">' if featured_image else ""

    return HTMLResponse(content=f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — {biz_name}</title>
  <meta name="description" content="{meta_desc}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{meta_desc}">
  {f'<meta property="og:image" content="{_esc(featured_image)}">' if featured_image else ''}
  <link rel="canonical" href="https://{_esc(subdomain)}.reevenow.com/blog/{_esc(post.get('slug', ''))}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family={font_heading.replace(' ', '+')}:wght@400;700&family={font_body.replace(' ', '+')}:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {{ --brand-primary: {primary}; --brand-secondary: {secondary}; --font-heading: '{font_heading}', serif; --font-body: '{font_body}', sans-serif; }}
    body {{ margin:0;font-family:var(--font-body);color:#333;background:#fafafa; }}
    article img {{ max-width:100%;height:auto;border-radius:4px; }}
    article h2,article h3 {{ font-family:var(--font-heading);color:var(--brand-primary); }}
    article a {{ color:var(--brand-primary); }}
  </style>
</head>
<body>
  <header style="background:var(--brand-primary);color:#fff;padding:1.5rem;text-align:center">
    <a href="/site/{_esc(subdomain)}" style="color:#fff;text-decoration:none;font-family:var(--font-heading);font-size:1.5rem;font-weight:700">{biz_name}</a>
    <nav style="margin-top:0.5rem"><a href="/site/{_esc(subdomain)}/blog" style="color:#fff;opacity:0.8;text-decoration:none;font-size:0.9rem">← All posts</a></nav>
  </header>
  <main style="max-width:720px;margin:0 auto;padding:2.5rem 1.5rem">
    {img_html}
    <h1 style="font-family:var(--font-heading);font-size:2.25rem;color:var(--brand-primary);margin:0 0 0.75rem">{title}</h1>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:2rem;flex-wrap:wrap">
      <time style="font-size:0.85rem;color:#999">{date_str}</time>
      {f'<div>{tag_html}</div>' if tag_html else ''}
    </div>
    <article style="line-height:1.8;font-size:1.05rem">
      {content}
    </article>
  </main>
</body>
</html>''')
