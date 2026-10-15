package email

import (
	"bytes"
	"html/template"
)

type theme struct {
	Product string
	Mark    string
	Page    template.CSS
	Accent  template.CSS
	Soft    template.CSS
	Border  template.CSS
	Ink     template.CSS
	Text    template.CSS
	Muted   template.CSS
}

type content struct {
	Preheader string
	Eyebrow   string
	Heading   string
	Greeting  string
	Body      string
	Action    string
	URL       string
	Note      string
	Footer    string
}

var emailTpl = template.Must(template.New("email").Parse(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{{.Heading}}</title>
</head>
<body style="margin:0;padding:0;background-color:{{.Page}};color:{{.Text}};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{{.Page}};">{{.Preheader}}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{{.Page}};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        {{.MSOOpen}}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 4px 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="36" height="36" align="center" valign="middle" bgcolor="{{.Accent}}" style="width:36px;height:36px;background-color:{{.Accent}};border-radius:18px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:36px;font-weight:700;color:#ffffff;">{{.Mark}}</td>
                  <td style="padding-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.2;font-weight:700;color:{{.Ink}};">{{.Product}}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid {{.Border}};border-radius:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="6" bgcolor="{{.Accent}}" style="height:6px;background-color:{{.Accent}};border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:{{.Accent}};">{{.Eyebrow}}</p>
                    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:700;color:{{.Ink}};">{{.Heading}}</h1>
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:{{.Text}};">{{.Greeting}}</p>
                    <p style="margin:0;font-size:16px;line-height:1.65;color:{{.Text}};">{{.Body}}</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:28px 32px 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="{{.Accent}}" style="border-radius:12px;background-color:{{.Accent}};">
                          <a href="{{.URL}}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">{{.Action}}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:{{.Muted}};">Jika tombol tidak terbuka, salin tautan ini ke peramban:</p>
                    <p style="margin:0;padding:12px 14px;background-color:{{.Page}};border-radius:10px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{{.URL}}" style="color:{{.Accent}};text-decoration:underline;">{{.URL}}</a></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px 20px;background-color:{{.Soft}};border-top:1px solid {{.Border}};border-radius:0 0 16px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:{{.Text}};">{{.Note}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:{{.Muted}};">{{.Footer}}</p>
            </td>
          </tr>
        </table>
        {{.MSOClose}}
      </td>
    </tr>
  </table>
</body>
</html>`))

func renderEmail(t theme, c content) string {
	data := struct {
		theme
		content
		MSOOpen  template.HTML
		MSOClose template.HTML
	}{
		theme:    t,
		content:  c,
		MSOOpen:  `<!--[if mso]><table role="presentation" align="center" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`,
		MSOClose: `<!--[if mso]></td></tr></table><![endif]-->`,
	}
	var buf bytes.Buffer
	if err := emailTpl.Execute(&buf, data); err != nil {
		return "<p>" + template.HTMLEscapeString(c.Greeting) + "</p><p><a href=\"" + template.HTMLEscapeString(c.URL) + "\">" + template.HTMLEscapeString(c.Action) + "</a></p>"
	}
	return buf.String()
}

func plainText(c content) string {
	return c.Heading + "\n\n" + c.Greeting + "\n\n" + c.Body + "\n\n" + c.Action + ": " + c.URL + "\n\n" + c.Note + "\n\n" + c.Footer
}
