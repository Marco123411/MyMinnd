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

interface PasswordResetEmailProps {
  clientName: string
  resetLink: string
}

export function PasswordResetEmail({ clientName, resetLink }: PasswordResetEmailProps) {
  const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'}/logo.png`
  return (
    <Html lang="fr">
      <Head />
      <Preview>Réinitialisez votre mot de passe MINND</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={logoSectionStyle}>
            <Img src={logoUrl} alt="MINND" width="180" style={{ display: 'block', margin: '0 auto' }} />
          </Section>

          <Hr style={dividerStyle} />

          <Section style={contentStyle}>
            <Heading style={headingStyle}>Bonjour {clientName},</Heading>

            <Text style={textStyle}>
              Votre coach a demandé une réinitialisation de votre mot de passe sur{' '}
              <strong>MINND</strong>.
            </Text>

            <Text style={textStyle}>
              Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe et
              accéder à votre espace personnel.
            </Text>

            <Section style={buttonSectionStyle}>
              <Button href={resetLink} style={buttonStyle}>
                Réinitialiser mon mot de passe
              </Button>
            </Section>

            <Text style={expiryStyle}>
              Ce lien est valable 1 heure. Si vous n'avez pas demandé cette
              réinitialisation, ignorez cet email — votre mot de passe reste inchangé.
            </Text>
          </Section>

          <Hr style={dividerStyle} />

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>MINND — Plateforme de performance mentale</Text>
            <Text style={footerTextStyle}>
              Vous recevez cet email car votre coach a initié une réinitialisation de
              mot de passe sur votre compte MINND.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail

PasswordResetEmail.PreviewProps = {
  clientName: 'Jean Martin',
  resetLink: 'https://myminnd.com/auth/reset-password',
} satisfies PasswordResetEmailProps

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
