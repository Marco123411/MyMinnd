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

interface ReviewRequestEmailProps {
  clientName: string
  expertName: string
  reviewUrl: string
}

export function ReviewRequestEmail({
  clientName,
  expertName,
  reviewUrl,
}: ReviewRequestEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Partagez votre expérience avec {expertName}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Heading style={logoStyle}>MINND</Heading>
            <Text style={logoSubtitleStyle}>Performance Mentale</Text>
          </Section>

          <Hr style={dividerStyle} />

          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {clientName},</Heading>

            <Text style={textStyle}>
              Votre session d&apos;accompagnement avec <strong>{expertName}</strong> est maintenant terminée.
              Nous espérons que cet échange a été enrichissant pour votre performance mentale.
            </Text>

            <Text style={textStyle}>
              Votre avis est précieux — il aide les autres membres à choisir leur expert et permet à {expertName} de progresser.
              Cela ne prend que quelques secondes.
            </Text>

            <Section style={buttonSectionStyle}>
              <Button href={reviewUrl} style={buttonStyle}>
                Laisser un avis
              </Button>
            </Section>

            <Text style={noteStyle}>
              Vous pouvez modifier votre avis dans les 7 jours suivant sa publication.
            </Text>
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

export default ReviewRequestEmail

ReviewRequestEmail.PreviewProps = {
  clientName: 'Jean Martin',
  expertName: 'Marie Dupont',
  reviewUrl: 'https://app.minnd.fr/client/review/123',
} satisfies ReviewRequestEmailProps

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
  margin: '24px 0 16px',
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

const noteStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '8px 0 0',
  textAlign: 'center',
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
