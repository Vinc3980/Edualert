import os
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

load_dotenv()

sg_key = os.getenv("SENDGRID_API_KEY")
from_email = os.getenv("FROM_EMAIL")
to_email = input("Enter your email address to test: ")

if not sg_key or not from_email:
    print("❌ Missing SENDGRID_API_KEY or FROM_EMAIL in .env")
else:
    message = Mail(
        from_email=from_email,
        to_emails=to_email,
        subject="EduAlert Test Email",
        html_content="<strong>This is a test email from EduAlert.</strong>"
    )
    try:
        sg = SendGridAPIClient(sg_key)
        response = sg.send(message)
        print(f"✅ Status code: {response.status_code}")
        print("Email sent successfully")
    except Exception as e:
        print(f"❌ Error: {e}")