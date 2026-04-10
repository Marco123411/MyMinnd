import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
  Img,
} from '@react-email/components'

interface DispatchExpertEmailProps {
  expertName: string
  clientName: string
  clientContext: string
  clientSport: string | null
  scoreGlobal: number | null
  profileName: string | null
  dispatchUrl: string
}

export function DispatchExpertEmail({
  expertName,
  clientName,
  clientContext,
  clientSport,
  scoreGlobal,
  profileName,
  dispatchUrl,
}: DispatchExpertEmailProps) {
  const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'}/logo.png`
  const contextLabel = CONTEXT_LABELS[clientContext] ?? clientContext

  return (
    <Html lang="fr">
      <Head />
      <Preview>
        Mission MINND : {clientName} attend votre analyse experte
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Img src={logoUrl} alt="MINND" width="180" style={{ display: 'block', margin: '0 auto' }} />
          </Section>

          <Hr style={dividerStyle} />

          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {expertName},</Heading>

            <Text style={textStyle}>
              Une nouvelle mission vous a été assignée. Un client attend votre
              accompagnement expert suite à son test Level 3.
            </Text>

            <Section style={profileBoxStyle}>
              <Text style={profileLabelStyle}>Profil du client</Text>
              <Text style={profileClientNameStyle}>{clientName}</Text>

              <Text style={profileDetailStyle}>
                <strong>Contexte :</strong> {contextLabel}
                {clientSport ? ` — ${clientSport}` : ''}
              </Text>

              {scoreGlobal !== null && (
                <Text style={profileDetailStyle}>
                  <strong>Score global :</strong> {scoreGlobal.toFixed(1)} / 10
                </Text>
              )}

              {profileName && (
                <Text style={profileDetailStyle}>
                  <strong>Profil MINND :</strong> {profileName}
                </Text>
              )}
            </Section>

            <Text style={textStyle}>
              Consultez le profil complet du client et acceptez ou déclinez la
              mission dans votre espace coach.
            </Text>

            <Section style={buttonSectionStyle}>
              <Button href={dispatchUrl} style={buttonStyle}>
                Voir la mission
              </Button>
            </Section>

            <Text style={noteStyle}>
              Vous avez 4 heures pour répondre à cette mission. Passé ce délai,
              elle pourra être réassignée.
            </Text>
          </Section>

          <Hr style={dividerStyle} />

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              MINND — Plateforme de performance mentale
            </Text>
            <Text style={footerTextStyle}>
              Vous recevez cet email car vous avez été sélectionné comme expert
              pour cette mission.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default DispatchExpertEmail

const CONTEXT_LABELS: Record<string, string> = {
  sport: 'Sport',
  corporate: 'Corporate',
  wellbeing: 'Bien-être',
  coaching: 'Coaching',
}

DispatchExpertEmail.PreviewProps = {
  expertName: 'Marie Dupont',
  clientName: 'Jean Martin',
  clientContext: 'sport',
  clientSport: 'Tennis',
  scoreGlobal: 7.4,
  profileName: 'Compétiteur Analytique',
  dispatchUrl: 'https://myminnd.com/coach/dispatch/abc-123',
} satisfies DispatchExpertEmailProps

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: '20px 0',
}

const containerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '0',
  overflow: 'hidden',
}

const logoSectionStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '24px 32px',
  textAlign: 'center',
}



const dividerStyle: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '0',
}

const contentStyle: React.CSSProperties = {
  padding: '32px',
}

const headingStyle: React.CSSProperties = {
  color: '#141325',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 16px',
}

const textStyle: React.CSSProperties = {
  color: '#52525b',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const profileBoxStyle: React.CSSProperties = {
  backgroundColor: '#F1F0FE',
  borderLeft: '4px solid #7069F4',
  borderRadius: '0 6px 6px 0',
  padding: '16px 20px',
  margin: '0 0 20px',
}

const profileLabelStyle: React.CSSProperties = {
  color: '#7069F4',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '1px',
  margin: '0 0 8px',
  textTransform: 'uppercase',
}

const profileClientNameStyle: React.CSSProperties = {
  color: '#141325',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0 0 12px',
}

const profileDetailStyle: React.CSSProperties = {
  color: '#52525b',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 6px',
}

const buttonSectionStyle: React.CSSProperties = {
  margin: '24px 0',
  textAlign: 'center',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#FF9F40',
  borderRadius: '6px',
  color: '#141325',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '700',
  padding: '12px 32px',
  textDecoration: 'none',
}

const noteStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0',
}

const footerStyle: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  padding: '20px 32px',
}

const footerTextStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center',
}
