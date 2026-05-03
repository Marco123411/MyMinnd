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

interface ContactRequestAcceptedEmailProps {
  athleteName: string
  coachName: string
  resultsUrl: string
}

export function ContactRequestAcceptedEmail({
  athleteName,
  coachName,
  resultsUrl,
}: ContactRequestAcceptedEmailProps) {
  const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'}/logo.png`
  return (
    <Html lang="fr">
      <Head />
      <Preview>{coachName} accepte de vous accompagner</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Img src={logoUrl} alt="MINND" width="180" style={{ display: 'block', margin: '0 auto' }} />
          </Section>
          <Hr style={dividerStyle} />
          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {athleteName},</Heading>
            <Text style={textStyle}>
              Bonne nouvelle&nbsp;! <strong>{coachName}</strong> a accepté votre demande
              d&apos;accompagnement.
            </Text>
            <Text style={textStyle}>
              Votre profil mental complet est maintenant débloqué. Vous pouvez accéder à&nbsp;:
            </Text>
            <ul style={listStyle}>
              <li style={listItemStyle}>Vos 31 compétences détaillées</li>
              <li style={listItemStyle}>Vos percentiles par rapport à la population</li>
              <li style={listItemStyle}>Des insights personnalisés</li>
              <li style={listItemStyle}>Des recommandations d&apos;outils mentaux</li>
            </ul>
            <Section style={buttonSectionStyle}>
              <Button href={resultsUrl} style={buttonStyle}>
                Voir mon profil complet
              </Button>
            </Section>
            <Text style={textStyle}>
              {coachName} vous contactera prochainement pour planifier votre première séance.
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

export default ContactRequestAcceptedEmail

ContactRequestAcceptedEmail.PreviewProps = {
  athleteName: 'Jean',
  coachName: 'Marie Dupont',
  resultsUrl: 'https://myminnd.com/client/results/abc-123',
} satisfies ContactRequestAcceptedEmailProps

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
const listStyle: React.CSSProperties = {
  color: '#1A1A2E',
  fontSize: '15px',
  lineHeight: '1.8',
  margin: '0 0 16px',
  paddingLeft: '20px',
}
const listItemStyle: React.CSSProperties = { margin: '4px 0' }
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
const footerStyle: React.CSSProperties = { backgroundColor: '#f4f4f5', padding: '20px 32px' }
const footerTextStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center',
}
