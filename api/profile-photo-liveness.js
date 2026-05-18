const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const serializeForInlineScript = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');

module.exports = async (req, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
  const verificationToken = typeof req.query.verificationToken === 'string' ? req.query.verificationToken.trim() : '';
  const pageConfig = {
    sessionId,
    verificationToken,
    region: process.env.AWS_COGNITO_REGION || 'eu-central-1',
    identityPoolId: process.env.AWS_COGNITO_IDENTITY_POOL_ID || '',
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  res.status(200).send(`<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AffairGo Live-Selfie</title>
    <link rel="stylesheet" href="https://unpkg.com/@aws-amplify/ui-react@6/styles.css" />
    <style>
      :root {
        color-scheme: light;
        --bg: #f5ede3;
        --surface: rgba(255, 252, 248, 0.96);
        --border: rgba(89, 57, 36, 0.14);
        --text: #2f1f16;
        --muted: #745648;
        --accent: #b34f2e;
        --accent-strong: #8d3416;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Georgia, 'Times New Roman', serif;
        background:
          radial-gradient(circle at top, rgba(179, 79, 46, 0.16), transparent 32%),
          linear-gradient(180deg, #fff8f0 0%, var(--bg) 100%);
        color: var(--text);
      }

      #root {
        min-height: 100vh;
      }

      .shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .card {
        width: min(100%, 920px);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 28px;
        box-shadow: 0 24px 80px rgba(60, 35, 21, 0.16);
        overflow: hidden;
      }

      .header {
        padding: 28px 28px 18px;
        border-bottom: 1px solid var(--border);
      }

      .eyebrow {
        font-size: 12px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent-strong);
        margin: 0 0 10px;
      }

      .title {
        margin: 0;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1;
      }

      .subtitle {
        margin: 12px 0 0;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.5;
      }

      .content {
        padding: 24px 28px 28px;
      }

      .panel {
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.64);
      }

      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin: 0 0 18px;
      }

      .meta-item {
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(179, 79, 46, 0.08);
      }

      .meta-label {
        display: block;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .meta-value {
        font-size: 15px;
        word-break: break-word;
      }

      .status-box {
        border-radius: 18px;
        padding: 16px 18px;
        margin-top: 16px;
      }

      .status-box.success {
        background: rgba(63, 122, 66, 0.12);
        color: #214a23;
      }

      .status-box.error {
        background: rgba(168, 38, 38, 0.1);
        color: #6a1d1d;
      }

      .button-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 18px;
      }

      .button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        cursor: pointer;
        background: var(--accent);
        color: white;
      }

      .button.secondary {
        background: rgba(47, 31, 22, 0.08);
        color: var(--text);
      }

      .helper {
        margin: 12px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .detector-wrap {
        min-height: 540px;
      }

      @media (max-width: 720px) {
        .shell {
          padding: 12px;
        }

        .header,
        .content {
          padding-left: 18px;
          padding-right: 18px;
        }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      const config = ${serializeForInlineScript(pageConfig)};

      const rootElement = document.getElementById('root');

      const renderBootstrapState = ({
        title,
        message,
        details = '',
        tone = 'neutral',
      }) => {
        const toneClass = tone === 'error' ? 'error' : tone === 'success' ? 'success' : '';

        rootElement.innerHTML = `
          <main class="shell">
            <section class="card">
              <header class="header">
                <p class="eyebrow">AffairGo Identity Check</p>
                <h1 class="title">Live-Selfie und Gesichtsabgleich</h1>
                <p class="subtitle">Die Aufnahme wird nur fuer diese Verifikation genutzt. Selfie-Rohdaten werden danach nicht dauerhaft gespeichert.</p>
              </header>
              <div class="content">
                <div class="meta">
                  <div class="meta-item">
                    <span class="meta-label">Session</span>
                    <span class="meta-value">${escapeHtml(sessionId || 'nicht gesetzt')}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">AWS Region</span>
                    <span class="meta-value">${escapeHtml(pageConfig.region)}</span>
                  </div>
                </div>
                <div class="panel">
                  <div class="status-box ${toneClass}">
                    <strong>${escapeHtml(title)}</strong>
                    <p class="helper" style="margin-top:10px;color:inherit;">${escapeHtml(message)}</p>
                    ${details ? `<p class="helper" style="margin-top:10px;font-family:monospace;white-space:pre-wrap;word-break:break-word;">${escapeHtml(details)}</p>` : ''}
                  </div>
                </div>
              </div>
            </section>
          </main>
        `;
      };

      renderBootstrapState({
        title: 'Fakecheck startet',
        message: 'Die Kamera-Komponente wird geladen. Wenn der Browser nach Kamerazugriff fragt, bitte erlauben.',
      });

      const notifyParent = (payload) => {
        const message = { type: 'affairgo-face-liveness', ...payload };

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, '*');
        }

        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      };

      const closeWindow = () => {
        window.close();
      };

      const bootstrap = async () => {
        try {
          const [
            reactModule,
            reactDomModule,
            amplifyUiModule,
            livenessModule,
            credentialProviderModule,
          ] = await Promise.all([
            import('https://esm.sh/react@18.2.0'),
            import('https://esm.sh/react-dom@18.2.0/client'),
            import('https://esm.sh/@aws-amplify/ui-react?deps=react@18.2.0,react-dom@18.2.0'),
            import('https://esm.sh/@aws-amplify/ui-react-liveness?deps=react@18.2.0,react-dom@18.2.0'),
            import('https://esm.sh/@aws-sdk/credential-providers'),
          ]);

          const React = reactModule.default || reactModule;
          const { useMemo, useState } = reactModule;
          const { createRoot } = reactDomModule;
          const { ThemeProvider, Loader } = amplifyUiModule;
          const { FaceLivenessDetectorCore } = livenessModule;
          const { fromCognitoIdentityPool } = credentialProviderModule;
          const e = React.createElement;

          function StatusView({ title, message, tone = 'success', actions = [] }) {
            return e('div', { className: 'status-box ' + tone }, [
              e('strong', { key: 'title' }, title),
              e('p', { key: 'message', className: 'helper', style: { marginTop: '10px', color: 'inherit' } }, message),
              actions.length
                ? e('div', { key: 'actions', className: 'button-row' }, actions.map((action) => (
                    e('button', {
                      key: action.label,
                      type: 'button',
                      className: 'button' + (action.variant === 'secondary' ? ' secondary' : ''),
                      onClick: action.onClick,
                    }, action.label)
                  )))
                : null,
            ]);
          }

          function App() {
            const [status, setStatus] = useState('ready');
            const [errorMessage, setErrorMessage] = useState('');

            const credentialProvider = useMemo(() => {
              if (!config.identityPoolId) {
                return null;
              }

              return fromCognitoIdentityPool({
                clientConfig: { region: config.region },
                identityPoolId: config.identityPoolId,
              });
            }, []);

            const missingConfigMessage = !config.identityPoolId
              ? 'Setze in Vercel oder deiner Hosting-Umgebung AWS_COGNITO_IDENTITY_POOL_ID. Ohne eine Identity Pool ID kann das AWS Face Liveness Web-Capture nicht starten.'
              : !config.sessionId || !config.verificationToken
                ? 'Die Seite wurde ohne gueltige Session geoeffnet. Starte die Profilbild-Pruefung erneut in AffairGo.'
                : '';

            const content = missingConfigMessage
              ? e(StatusView, {
                  title: 'Liveness-Konfiguration fehlt',
                  message: missingConfigMessage,
                  tone: 'error',
                  actions: [{ label: 'Fenster schliessen', onClick: closeWindow }],
                })
              : status === 'complete'
                ? e(StatusView, {
                    title: 'Live-Selfie abgeschlossen',
                    message: 'Die Aufnahme ist abgeschlossen. Wenn AffairGo im Browser geoeffnet ist, wird die Profilbild-Pruefung automatisch fortgesetzt. Andernfalls wechsle zurueck in die App und schliesse dort die Pruefung ab.',
                    tone: 'success',
                    actions: [{ label: 'Fenster schliessen', onClick: closeWindow }],
                  })
                : status === 'error'
                  ? e(StatusView, {
                      title: 'Live-Selfie fehlgeschlagen',
                      message: errorMessage || 'Der Liveness-Flow konnte nicht abgeschlossen werden. Starte die Profilbild-Pruefung in AffairGo erneut.',
                      tone: 'error',
                      actions: [
                        { label: 'Fenster schliessen', onClick: closeWindow },
                        { label: 'Seite neu laden', variant: 'secondary', onClick: () => window.location.reload() },
                      ],
                    })
                  : e('div', { className: 'detector-wrap' },
                      e(FaceLivenessDetectorCore, {
                        sessionId: config.sessionId,
                        region: config.region,
                        onAnalysisComplete: async () => {
                          setStatus('complete');
                          notifyParent({
                            status: 'analysis_complete',
                            sessionId: config.sessionId,
                            verificationToken: config.verificationToken,
                          });
                        },
                        onUserCancel: () => {
                          setStatus('error');
                          setErrorMessage('Die Live-Selfie-Pruefung wurde abgebrochen.');
                          notifyParent({
                            status: 'cancelled',
                            sessionId: config.sessionId,
                            verificationToken: config.verificationToken,
                          });
                        },
                        onError: (livenessError) => {
                          const nextMessage = livenessError?.error?.message || 'Beim Face-Liveness-Check ist ein Fehler aufgetreten.';
                          setStatus('error');
                          setErrorMessage(nextMessage);
                          notifyParent({
                            status: 'error',
                            sessionId: config.sessionId,
                            verificationToken: config.verificationToken,
                            errorMessage: nextMessage,
                          });
                        },
                        config: {
                          credentialProvider,
                        },
                      })
                    );

            return e(ThemeProvider, null,
              e('main', { className: 'shell' },
                e('section', { className: 'card' }, [
                  e('header', { key: 'header', className: 'header' }, [
                    e('p', { key: 'eyebrow', className: 'eyebrow' }, 'AffairGo Identity Check'),
                    e('h1', { key: 'title', className: 'title' }, 'Live-Selfie und Gesichtsabgleich'),
                    e('p', { key: 'subtitle', className: 'subtitle' }, 'Die Aufnahme wird nur fuer diese Verifikation genutzt. Selfie-Rohdaten werden danach nicht dauerhaft gespeichert.'),
                  ]),
                  e('div', { key: 'content', className: 'content' }, [
                    e('div', { key: 'meta', className: 'meta' }, [
                      e('div', { key: 'session', className: 'meta-item' }, [
                        e('span', { key: 'label', className: 'meta-label' }, 'Session'),
                        e('span', { key: 'value', className: 'meta-value' }, config.sessionId || 'nicht gesetzt'),
                      ]),
                      e('div', { key: 'region', className: 'meta-item' }, [
                        e('span', { key: 'label', className: 'meta-label' }, 'AWS Region'),
                        e('span', { key: 'value', className: 'meta-value' }, config.region),
                      ]),
                    ]),
                    e('div', { key: 'panel', className: 'panel' }, [
                      status === 'ready'
                        ? e('div', { key: 'loading', style: { marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' } }, [
                            e(Loader, { key: 'loader', variation: 'linear', width: '120px' }),
                            e('span', { key: 'text', className: 'helper', style: { marginTop: 0 } }, 'Kamera wird initialisiert. Erlaube den Kamerazugriff, wenn der Browser fragt.'),
                          ])
                        : null,
                      content,
                    ]),
                  ]),
                ])
              )
            );
          }

          createRoot(rootElement).render(e(App));
        } catch (error) {
          const nextMessage = error?.message || 'Die Kamera-Komponente konnte nicht geladen werden.';

          console.error('AffairGo liveness bootstrap failed', error);
          notifyParent({
            status: 'error',
            sessionId: config.sessionId,
            verificationToken: config.verificationToken,
            errorMessage: nextMessage,
          });

          renderBootstrapState({
            title: 'Fakecheck konnte nicht geladen werden',
            message: 'Die Selfie-Komponente wurde nicht erfolgreich initialisiert.',
            details: nextMessage,
            tone: 'error',
          });
        }
      };

      bootstrap();
    </script>
  </body>
</html>`);
};