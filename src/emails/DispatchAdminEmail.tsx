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
  Row,
  Column,
} from '@react-email/components'

interface DispatchAdminEmailProps {
  title: string
  message: string
  details: Record<string, string>
  ctaUrl?: string
  ctaLabel?: string
}

export function DispatchAdminEmail({
  title,
  message,
  details,
  ctaUrl,
  ctaLabel,
}: DispatchAdminEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Heading style={logoStyle}>MINND</Heading>
            <Text style={logoSubtitleStyle}>Administration</Text>
          </Section>

          <Hr style={dividerStyle} />

          <Section style={contentStyle}>
            <Heading style={headingStyle}>{title}</Heading>

            <Text style={textStyle}>{message}</Text>

            <Section style={detailsBoxStyle}>
              {Object.entries(details).map(([key, value]) => (
                <Row key={key} style={detailRowStyle}>
                  <Column style={detailKeyStyle}>{key}</Column>
                  <Column style={detailValueStyle}>{value}</Column>
                </Row>
              ))}
            </Section>

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
              MINND — Notification interne administration
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default DispatchAdminEmail

DispatchAdminEmail.PreviewProps = {
  title: 'Nouvelle demande Level 3',
  message: 'Un client vient de payer un test Level 3 et attend un expert.',
  details: {
    Client: 'Jean Martin',
    Context: 'Sport',
    Sport: 'Tennis',
    'Score global': '7.4 / 10',
    'Profil MINND': 'Compétiteur Analytique',
  },
  ctaUrl: 'https://myminnd.com/admin/dispatch/abc-123',
  ctaLabel: 'Voir le dispatch',
} satisfies DispatchAdminEmailProps

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
  margin: '0 0 20px',
}

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: '#E8F4F5',
  borderRadius: '6px',
  padding: '16px',
  margin: '0 0 20px',
}

const detailRowStyle: React.CSSProperties = {
  marginBottom: '8px',
}

const detailKeyStyle: React.CSSProperties = {
  color: '#52525b',
  fontSize: '13px',
  fontWeight: '600',
  width: '40%',
}

const detailValueStyle: React.CSSProperties = {
  color: '#1A1A2E',
  fontSize: '13px',
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
