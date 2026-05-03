import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Section,
  Img,
} from '@react-email/components'

interface ContactRequestExpiredEmailProps {
  athleteName: string
  coachName: string
}

export function ContactRequestExpiredEmail({
  athleteName,
  coachName,
}: ContactRequestExpiredEmailProps) {
  const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'}/logo.png`
  return (
    <Html lang="fr">
      <Head />
      <Preview>Votre demande a expiré</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Img src={logoUrl} alt="MINND" width="180" style={{ display: 'block', margin: '0 auto' }} />
          </Section>
          <Hr style={dividerStyle} />
          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {athleteName},</Heading>
            <Text style={textStyle}>
              Votre demande d&apos;accompagnement envoyée à <strong>{coachName}</strong> a
              expiré sans réponse.
            </Text>
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

export default ContactRequestExpiredEmail

ContactRequestExpiredEmail.PreviewProps = {
  athleteName: 'Jean',
  coachName: 'Marie Dupont',
} satisfies ContactRequestExpiredEmailProps

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
const footerStyle: React.CSSProperties = { backgroundColor: '#f4f4f5', padding: '20px 32px' }
const footerTextStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center',
}
