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

interface TestCompletedCoachEmailProps {
  coachName: string
  clientName: string
  testName: string
  levelSlug: string
  globalScore: number
  annotateUrl: string
}

export function TestCompletedCoachEmail({
  coachName,
  clientName,
  testName,
  globalScore,
  annotateUrl,
}: TestCompletedCoachEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>
        {clientName} a complété son test {testName}
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
            <Heading style={headingStyle}>Bonjour {coachName},</Heading>

            <Text style={textStyle}>
              Votre client <strong>{clientName}</strong> vient de compléter le test{' '}
              <strong>{testName}</strong> avec un score de{' '}
              <strong>{globalScore.toFixed(1)}/10</strong>.
            </Text>

            <Text style={textStyle}>
              Annotez les résultats et publiez-les pour que votre client puisse les consulter.
            </Text>

            <Section style={buttonSectionStyle}>
              <Button href={annotateUrl} style={buttonStyle}>
                Voir et annoter les résultats
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
              Vous recevez cet email car un de vos clients vient de compléter un test.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default TestCompletedCoachEmail

TestCompletedCoachEmail.PreviewProps = {
  coachName: 'Marie Dupont',
  clientName: 'Jean Martin',
  testName: 'Profil Mental Athlétique (PMA)',
  levelSlug: 'complete',
  globalScore: 7.4,
  annotateUrl: 'https://myminnd.com/coach/tests/abc-123/results',
} satisfies TestCompletedCoachEmailProps

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
