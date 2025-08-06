const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface EmailRequest {
  to: string;
  name: string;
  otp: string;
  from: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, name, otp, from }: EmailRequest = await req.json();

    // Email template
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Interview Platform - OTP Verification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-code { background: #10B981; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; text-align: center; border-radius: 8px; margin: 20px 0; letter-spacing: 4px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Interview Platform</h1>
                <p>OTP Verification Required</p>
            </div>
            <div class="content">
                <h2>Hello ${name},</h2>
                <p>Welcome to our Interview Platform! To complete your registration and access the interview system, please use the following One-Time Password (OTP):</p>
                
                <div class="otp-code">${otp}</div>
                
                <p><strong>Important:</strong></p>
                <ul>
                    <li>This OTP is valid for 10 minutes only</li>
                    <li>Do not share this code with anyone</li>
                    <li>Use this code to verify your email and proceed with the interview</li>
                </ul>
                
                <p>If you didn't request this OTP, please ignore this email.</p>
                
                <p>Good luck with your interview!</p>
                
                <p>Best regards,<br>The Interview Platform Team</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // In a real implementation, you would use a proper email service like SendGrid, AWS SES, etc.
    // For this demo, we'll simulate sending the email
    console.log(`Sending OTP email to ${to} from ${from}`);
    console.log(`OTP: ${otp}`);
    console.log(`Email HTML:`, emailHtml);

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `OTP sent successfully to ${to}`,
        // In development, return the OTP for testing
        otp: Deno.env.get('DENO_ENV') === 'development' ? otp : undefined
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Error sending OTP email:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send OTP email', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});