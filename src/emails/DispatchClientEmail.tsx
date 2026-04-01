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
} from '@react-email/components'

interface DispatchClientEmailProps {
  clientName: string
  expertName: string
  messageType: 'accepted' | 'session_done'
  ctaUrl?: string
  ctaLabel?: string
}

export function DispatchClientEmail({
  clientName,
  expertName,
  messageType,
  ctaUrl,
  ctaLabel,
}: DispatchClientEmailProps) {
  const content = MESSAGE_CONTENT[messageType]

  return (
    <Html lang="fr">
      <Head />
      <Preview>{content.preview(expertName)}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Heading style={logoStyle}>MINND</Heading>
            <Text style={logoSubtitleStyle}>Performance Mentale</Text>
          </Section>

          <Hr style={dividerStyle} />

          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {clientName},</Heading>

            <Text style={textStyle}>{content.body(expertName)}</Text>

            {ctaUrl && ctaLabel && (
              <Section style={buttonSectionStyle}>
                <Button href={ctaUrl} style={buttonStyle}>
                  {ctaLabel}
                </Button>
              </Section>
            )}
          </Section>

          <Hr style={dividerStyle} />

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              MINND — Plateforme de performance mentale
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default DispatchClientEmail

const MESSAGE_CONTENT: Record<
  'accepted' | 'session_done',
  { preview: (e: string) => string; body: (e: string) => string }
> = {
  accepted: {
    preview: (expert) => `${expert} va vous contacter sous 24h`,
    body: (expert) =>
      `Bonne nouvelle ! ${expert} a accepté votre mission d'accompagnement. Il ou elle prendra contact avec vous dans les prochaines 24 heures pour organiser votre session d'analyse (30 à 45 minutes).`,
  },
  session_done: {
    preview: (expert) => `Votre session avec ${expert} est terminée`,
    body: (expert) =>
      `Votre session d'accompagnement avec ${expert} est maintenant terminée. Nous espérons que cet échange vous a apporté des insights précieux pour votre performance mentale. N'hésitez pas à laisser un avis sur votre expérience.`,
  },
}

DispatchClientEmail.PreviewProps = {
  clientName: 'Jean Martin',
  expertName: 'Marie Dupont',
  messageType: 'accepted',
} satisfies DispatchClientEmailProps

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
  backgroundColor: '#1A1A2E',
  padding: '24px 32px',
  textAlign: 'center',
}

const logoStyle: React.CSSProperties = {
  color: '#20808D',
  fontSize: '28px',
  fontWeight: '800',
  letterSpacing: '4px',
  margin: '0',
}

const logoSubtitleStyle: React.CSSProperties = {
  color: '#E8F4F5',
  fontSize: '12px',
  letterSpacing: '2px',
  margin: '4px 0 0',
  textTransform: 'uppercase',
}

const dividerStyle: React.CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '0',
}

const contentStyle: React.CSSProperties = {
  padding: '32px',
}

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

const buttonSectionStyle: React.CSSProperties = {
  margin: '24px 0 0',
  textAlign: 'center',
}

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

const footerStyle: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  padding: '20px 32px',
}

const footerTextStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0',
  textAlign: 'center',
}
