"""
ReeveOS Email Base Template
============================
Production HTML email template using table-based layout.
Compatible with Gmail, Outlook, Apple Mail, Yahoo.
All styles inline. No CSS grid/flexbox.

Usage:
    from helpers.email_base import render_email
    html = render_email(
        body_html="<h1>Hello</h1>",
        business={"name": "Rejuvenate", "address": "Barry", "email": "info@rejuvenate.com", "logo_url": None},
        show_powered=True,
        show_unsub=False
    )
"""

# Brand colours
BLACK = "#111111"
GOLD = "#C9A84C"
WHITE = "#FFFFFF"
BG = "#FAFAF8"
TEXT = "#2C2C2A"
MUTED = "#7A776F"
BORDER = "#E8E4DD"
FOOTER_BG = "#F5F5F3"
LIGHT_GOLD = "#F9F3E3"

# Alert colours
WARN_BG = "#FFF8E1"
WARN_BD = "#FFA726"
WARN_TX = "#E65100"
RED_BG = "#FEF2F2"
RED_BD = "#EF5350"
RED_TX = "#B71C1C"
GREEN_BG = "#F0FDF4"
GREEN_BD = "#66BB6A"
GREEN_TX = "#1B5E20"


def render_email(body_html: str, business: dict, show_powered: bool = True, show_unsub: bool = False) -> str:
    """Wrap body HTML in the full email template."""
    biz_name = business.get("name", "ReeveOS")
    biz_address = business.get("address", "")
    logo_url = business.get("logo_url")
    
    # Header: white-label with logo, or ReeveOS branding
    if logo_url:
        header_content = f'''
            <img src="{logo_url}" alt="{biz_name}" style="max-width:120px;max-height:40px;display:block;" />
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{BLACK};font-weight:bold;margin-top:4px;display:block;">{biz_name}</span>
        '''
    elif biz_name != "ReeveOS":
        # White-label without logo — show initial + name
        initial = biz_name[0].upper() if biz_name else "R"
        header_content = f'''
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="padding-right:8px;vertical-align:middle;">
                    <div style="width:28px;height:28px;background-color:{GOLD};border-radius:6px;text-align:center;line-height:28px;">
                        <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{BLACK};font-weight:bold;">{initial}</span>
                    </div>
                </td>
                <td style="vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{BLACK};font-weight:bold;">{biz_name}</span>
                </td>
            </tr></table>
        '''
    else:
        # ReeveOS branding
        header_content = f'''
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="padding-right:8px;vertical-align:middle;">
                    <div style="width:16px;height:16px;background-color:{GOLD};border-radius:2px;text-align:center;line-height:16px;">
                        <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:{BLACK};font-weight:bold;">R</span>
                    </div>
                </td>
                <td style="vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{GOLD};font-weight:bold;">ReeveOS</span>
                </td>
            </tr></table>
        '''
    
    powered_html = f'<p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;text-align:center;">Powered by ReeveOS</p>' if show_powered else ''
    unsub_html = f'<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-align:center;"><a href="{{{{unsubscribe_url}}}}" style="color:{GOLD};text-decoration:none;">Unsubscribe</a></p>' if show_unsub else ''
    
    return f'''<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{biz_name}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:{BG};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:{BG};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:{BG};">
          
          <!-- HEADER -->
          <tr>
            <td style="padding:20px 0;background-color:{BG};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr><td align="left" style="padding:0 40px;">{header_content}</td></tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:20px;">
                <tr><td style="border-top:1px solid {GOLD};"></td></tr>
              </table>
            </td>
          </tr>
          
          <!-- BODY -->
          <tr>
            <td style="padding:30px 40px;background-color:{WHITE};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:520px;">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:{TEXT};">
                    {body_html}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 40px;background-color:{FOOTER_BG};border-top:1px solid {BORDER};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                {powered_html}
                <tr><td align="center" style="padding-bottom:6px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;">{biz_name}, {biz_address}</p>
                </td></tr>
                <tr><td align="center">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;">You received this because you have an account with {biz_name}</p>
                </td></tr>
                {unsub_html}
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'''


# ═══ REUSABLE HTML BLOCKS ═══

def heading(text: str) -> str:
    return f'<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:normal;color:{BLACK};line-height:1.2;">{text}</h1>'


def paragraph(text: str, muted: bool = False, small: bool = False) -> str:
    color = MUTED if muted else TEXT
    size = "13px" if small else "14px"
    return f'<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:{size};line-height:1.6;color:{color};">{text}</p>'


def detail_card(rows: list) -> str:
    """Gold left-border card with label/value pairs. rows = [{"label": "...", "value": "..."}]"""
    rows_html = ""
    for i, row in enumerate(rows):
        pb = "12px" if i < len(rows) - 1 else "0"
        rows_html += f'''
            <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MUTED};padding-bottom:4px;">{row["label"]}</td></tr>
            <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{BLACK};font-weight:bold;padding-bottom:{pb};">{row["value"]}</td></tr>
        '''
    return f'''<div style="margin:24px 0;padding:20px;background-color:{LIGHT_GOLD};border-left:3px solid {GOLD};border-radius:4px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tbody>{rows_html}</tbody></table>
    </div>'''


def alert(text: str, variant: str = "warn") -> str:
    """Alert banner. variant: warn, error, success"""
    styles = {
        "warn": {"bg": WARN_BG, "bd": WARN_BD, "tx": WARN_TX},
        "error": {"bg": RED_BG, "bd": RED_BD, "tx": RED_TX},
        "success": {"bg": GREEN_BG, "bd": GREEN_BD, "tx": GREEN_TX},
    }
    s = styles.get(variant, styles["warn"])
    return f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
        <tr><td style="padding:16px 20px;background-color:{s["bg"]};border-left:4px solid {s["bd"]};border-radius:4px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:{s["tx"]};">{text}</p>
        </td></tr>
    </table>'''


def button(text: str, url: str = "#", secondary: bool = False) -> str:
    """CTA button. Primary = gold bg, Secondary = white bg with border."""
    if secondary:
        style = f"display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{BLACK};text-decoration:none;font-weight:bold;border:2px solid {BORDER};border-radius:4px;background-color:{WHITE};"
    else:
        style = f"display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{BLACK};text-decoration:none;font-weight:bold;border-radius:4px;background-color:{GOLD};"
    return f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:{'8px' if secondary else '20px'} 0;">
        <tr><td style="border-radius:4px;{'background-color:' + GOLD if not secondary else 'background-color:' + WHITE};">
            <a href="{url}" style="{style}">{text}</a>
        </td></tr>
    </table>'''


def divider(gold: bool = False) -> str:
    color = GOLD if gold else BORDER
    return f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;"><tr><td style="border-top:1px solid {color};font-size:0;line-height:0;">&nbsp;</td></tr></table>'


def staff_card(name: str, role: str, initial: str = None) -> str:
    ini = initial or name[0].upper()
    return f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;">
        <tr>
            <td style="width:40px;vertical-align:middle;">
                <div style="width:40px;height:40px;background-color:{GOLD};border-radius:20px;text-align:center;line-height:40px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:{BLACK};">{ini}</span>
                </div>
            </td>
            <td style="padding-left:12px;vertical-align:middle;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:{BLACK};">{name}</span><br/>
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{MUTED};">{role}</span>
            </td>
        </tr>
    </table>'''


def icon_row(icon: str, title: str, desc: str) -> str:
    return f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px;" width="100%">
        <tr>
            <td style="width:32px;vertical-align:top;">
                <div style="width:32px;height:32px;background-color:{LIGHT_GOLD};border-radius:16px;text-align:center;line-height:32px;font-size:14px;">{icon}</div>
            </td>
            <td style="padding-left:12px;vertical-align:top;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:{BLACK};">{title}</span><br/>
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{MUTED};">{desc}</span>
            </td>
        </tr>
    </table>'''


def reassurance_box(amount: str, message: str, thanks: str = "") -> str:
    """Dojo-style plain English payment box."""
    thanks_html = f'<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MUTED};">{thanks}</p>' if thanks else ''
    return f'''<div style="margin:24px 0;padding:20px;background-color:{BG};border-left:3px solid {GOLD};border-radius:4px;">
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;color:{BLACK};">{amount}</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:{TEXT};">{message}</p>
        {thanks_html}
    </div>'''


def line_item(label: str, amount: str, bold: bool = False, muted: bool = False) -> str:
    color = MUTED if muted else BLACK
    weight = "bold" if bold else "normal"
    return f'''<tr>
        <td style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{color};font-weight:{weight};">{label}</td>
        <td style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{color};font-weight:{weight};text-align:right;">{amount}</td>
    </tr>'''


def total_row(label: str, amount: str) -> str:
    return f'''<tr>
        <td style="padding:14px 0;border-top:2px solid {BLACK};font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{BLACK};font-weight:bold;">{label}</td>
        <td style="padding:14px 0;border-top:2px solid {BLACK};font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{BLACK};font-weight:bold;text-align:right;">{amount}</td>
    </tr>'''


def detail_row(label: str, value: str) -> str:
    return f'''<tr>
        <td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{MUTED};">{label}</td>
        <td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{BLACK};text-align:right;">{value}</td>
    </tr>'''


def stat_box(label: str, value: str, sub: str = "") -> str:
    sub_html = f'<span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:{MUTED};">{sub}</span>' if sub else ''
    return f'''<td style="padding:14px;background-color:{BG};border-radius:8px;text-align:center;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:{MUTED};text-transform:uppercase;letter-spacing:1px;">{label}</span><br/>
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:{BLACK};">{value}</span><br/>
        {sub_html}
    </td>'''
