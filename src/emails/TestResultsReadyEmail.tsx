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

interface TestResultsReadyEmailProps {
  clientName: string
  coachName: string
  testName: string
  resultsUrl: string
}

export function TestResultsReadyEmail({
  clientName,
  coachName,
  testName,
  resultsUrl,
}: TestResultsReadyEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>
        Vos résultats &quot;{testName}&quot; sont disponibles sur MINND
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Logo MINND */}
          <Section style={logoSectionStyle}>
            <Heading style={logoStyle}>MINND</Heading>
            <Text style={logoSubtitleStyle}>Performance Mentale</Text>
          </Section>

          <Hr style={dividerStyle} />

          {/* Corps */}
          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {clientName},</Heading>

            <Text style={textStyle}>
              Votre coach <strong>{coachName}</strong> a préparé votre restitution
              personnalisée pour le test <strong>{testName}</strong>.
            </Text>

            <Text style={textStyle}>
              Vos résultats sont maintenant disponibles. Découvrez votre profil mental
              et les annotations de votre coach.
            </Text>

            <Section style={buttonSectionStyle}>
              <Button href={resultsUrl} style={buttonStyle}>
                Voir mes résultats
              </Button>
            </Section>
          </Section>

          <Hr style={dividerStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              MINND — Plateforme de performance mentale
            </Text>
            <Text style={footerTextStyle}>
              Vous recevez cet email car votre coach a publié vos résultats de test.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default TestResultsReadyEmail

TestResultsReadyEmail.PreviewProps = {
  clientName: 'Jean Martin',
  coachName: 'Marie Dupont',
  testName: 'Profil Mental Athlétique (PMA)',
  resultsUrl: 'https://myminnd.com/client/results/abc-123',
} satisfies TestResultsReadyEmailProps

// Styles inline (compatibilité clients email)
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
  margin: '24px 0',
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
  margin: '0 0 8px',
  textAlign: 'center',
}
