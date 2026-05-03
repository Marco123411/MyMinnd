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

interface ContactRequestCoachEmailProps {
  coachName: string
  athleteName: string
  profileName: string | null
  globalScore: number | null
  sport: string | null
  level: string | null
  objective: string | null
  leadsUrl: string
}

export function ContactRequestCoachEmail({
  coachName,
  athleteName,
  profileName,
  globalScore,
  sport,
  level,
  objective,
  leadsUrl,
}: ContactRequestCoachEmailProps) {
  const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'}/logo.png`
  return (
    <Html lang="fr">
      <Head />
      <Preview>Nouvelle demande d&apos;accompagnement — {athleteName}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Img
              src={logoUrl}
              alt="MINND"
              width="180"
              style={{ display: 'block', margin: '0 auto' }}
            />
          </Section>
          <Hr style={dividerStyle} />
          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {coachName},</Heading>
            <Text style={textStyle}>
              <strong>{athleteName}</strong> souhaite être accompagné(e) en préparation mentale
              et a consulté votre profil sur MyMINND.
            </Text>

            <Section style={summaryStyle}>
              {profileName && (
                <Text style={summaryLineStyle}>
                  <strong>Profil mental :</strong> {profileName}
                </Text>
              )}
              {globalScore !== null && (
                <Text style={summaryLineStyle}>
                  <strong>Score global :</strong> {globalScore.toFixed(1)}/10
                </Text>
              )}
              {sport && (
                <Text style={summaryLineStyle}>
                  <strong>Sport :</strong> {sport}
                </Text>
              )}
              {level && (
                <Text style={summaryLineStyle}>
                  <strong>Niveau :</strong> {level}
                </Text>
              )}
              {objective && (
                <Text style={summaryLineStyle}>
                  <strong>Objectif :</strong> « {objective} »
                </Text>
              )}
            </Section>

            <Section style={buttonSectionStyle}>
              <Button href={leadsUrl} style={buttonStyle}>
                Voir la demande
              </Button>
            </Section>

            <Text style={expiryStyle}>Cette demande expire dans 14 jours.</Text>
          </Section>
          <Hr style={dividerStyle} />
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>MINND — Plateforme de performance mentale</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default ContactRequestCoachEmail

ContactRequestCoachEmail.PreviewProps = {
  coachName: 'Marie',
  athleteName: 'Jean Martin',
  profileName: 'Le Stratège',
  globalScore: 7.2,
  sport: 'Tennis',
  level: 'amateur',
  objective: 'Améliorer ma gestion du stress en compétition',
  leadsUrl: 'https://myminnd.com/coach/leads',
} satisfies ContactRequestCoachEmailProps

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
  overflow: 'hidden',
}
const logoSectionStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '24px 32px',
  textAlign: 'center',
}
const dividerStyle: React.CSSProperties = { borderColor: '#e4e4e7', margin: '0' }
const contentStyle: React.CSSProperties = { padding: '32px' }
const headingStyle: React.CSSProperties = {
  color: '#1A1A2E',
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
const summaryStyle: React.CSSProperties = {
  backgroundColor: '#E8F4F5',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
}
const summaryLineStyle: React.CSSProperties = {
  color: '#1A1A2E',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '4px 0',
}
const buttonSectionStyle: React.CSSProperties = { margin: '24px 0', textAlign: 'center' }
const buttonStyle: React.CSSProperties = {
  backgroundColor: '#20808D',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 32px',
  textDecoration: 'none',
}
const expiryStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '16px 0 0',
  textAlign: 'center',
}
const footerStyle: React.CSSProperties = { backgroundColor: '#f4f4f5', padding: '20px 32px' }
const footerTextStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center',
}
