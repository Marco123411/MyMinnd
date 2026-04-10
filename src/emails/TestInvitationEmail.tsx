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

interface TestInvitationEmailProps {
  coachName: string
  clientName: string
  testName: string
  inviteUrl: string
  expiresAt: string // date formatée en français
}

export function TestInvitationEmail({
  coachName,
  clientName,
  testName,
  inviteUrl,
  expiresAt,
}: TestInvitationEmailProps) {
  const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'}/logo.png`
  return (
    <Html lang="fr">
      <Head />
      <Preview>
        {coachName} vous invite à passer le {testName} sur MINND
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}><Section style={logoSectionStyle}>
            <Img src={logoUrl} alt="MINND" width="180" style={{ display: 'block', margin: '0 auto' }} />
          </Section>

          <Hr style={dividerStyle} />

          {/* Corps */}
          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {clientName},</Heading>

            <Text style={textStyle}>
              <strong>{coachName}</strong> vous invite à passer le test{' '}
              <strong>{testName}</strong> sur la plateforme MINND.
            </Text>

            <Text style={textStyle}>
              Ce test vous permettra d'obtenir une analyse approfondie de votre
              performance mentale et d'identifier vos points forts et axes de
              développement.
            </Text>

            <Section style={buttonSectionStyle}>
              <Button href={inviteUrl} style={buttonStyle}>
                Passer le test
              </Button>
            </Section>

            <Text style={expiryStyle}>
              Ce lien expire le {expiresAt}. Passé ce délai, demandez un nouveau
              lien à votre coach.
            </Text>
          </Section>

          <Hr style={dividerStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              MINND — Plateforme de performance mentale
            </Text>
            <Text style={footerTextStyle}>
              Vous recevez cet email car votre coach vous a invité à passer un
              test. Si vous pensez avoir reçu cet email par erreur, ignorez-le.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default TestInvitationEmail

TestInvitationEmail.PreviewProps = {
  coachName: 'Marie Dupont',
  clientName: 'Jean Martin',
  testName: 'Profil Mental Athlétique (PMA)',
  inviteUrl: 'https://myminnd.com/test/invite/abc-123',
  expiresAt: '30 avril 2026',
} satisfies TestInvitationEmailProps

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

const buttonSectionStyle: React.CSSProperties = {
  margin: '24px 0',
  textAlign: 'center',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#7069F4',
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
