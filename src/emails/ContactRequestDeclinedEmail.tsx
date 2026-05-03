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

interface ContactRequestDeclinedEmailProps {
  athleteName: string
  coachName: string
  coachMessage?: string | null
  marketplaceUrl: string
}

export function ContactRequestDeclinedEmail({
  athleteName,
  coachName,
  coachMessage,
  marketplaceUrl,
}: ContactRequestDeclinedEmailProps) {
  const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'}/logo.png`
  return (
    <Html lang="fr">
      <Head />
      <Preview>Mise à jour de votre demande</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Img src={logoUrl} alt="MINND" width="180" style={{ display: 'block', margin: '0 auto' }} />
          </Section>
          <Hr style={dividerStyle} />
          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {athleteName},</Heading>
            <Text style={textStyle}>
              <strong>{coachName}</strong> ne peut malheureusement pas vous accompagner pour le
              moment.
            </Text>
            {coachMessage && (
              <Section style={messageStyle}>
                <Text style={messageTextStyle}>« {coachMessage} »</Text>
              </Section>
            )}
            <Text style={textStyle}>
              De nombreux autres préparateurs mentaux certifiés MINND sont disponibles sur notre
              annuaire.
            </Text>
            <Section style={buttonSectionStyle}>
              <Button href={marketplaceUrl} style={buttonStyle}>
                Consulter l&apos;annuaire
              </Button>
            </Section>
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

export default ContactRequestDeclinedEmail

ContactRequestDeclinedEmail.PreviewProps = {
  athleteName: 'Jean',
  coachName: 'Marie Dupont',
  coachMessage: 'Mon agenda est complet pour les 3 prochains mois.',
  marketplaceUrl: 'https://myminnd.com/marketplace',
} satisfies ContactRequestDeclinedEmailProps

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
const messageStyle: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  borderLeft: '3px solid #944454',
  padding: '12px 16px',
  margin: '16px 0',
}
const messageTextStyle: React.CSSProperties = {
  color: '#1A1A2E',
  fontSize: '14px',
  fontStyle: 'italic',
  lineHeight: '1.5',
  margin: '0',
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
const footerStyle: React.CSSProperties = { backgroundColor: '#f4f4f5', padding: '20px 32px' }
const footerTextStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center',
}
