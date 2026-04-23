<?php
//Import PHPMailer classes into the global namespace
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

require __DIR__ .'/Exception.php';
require __DIR__ .'/PHPMailer.php';
require __DIR__ .'/SMTP.php';

function getMailer() {
  //Create an instance; passing `true` enables exceptions
  $mail = new PHPMailer(true);

  //Server settings
  #$mail->SMTPDebug = SMTP::DEBUG_SERVER;                      //Enable verbose debug output
  $mail->isSMTP();                                            //Send using SMTP
  $mail->Host       = getenv("EMAIL_HOST") ?: "localhost";    //Set the SMTP server to send through
  $emailUser        = getenv("EMAIL_USER");
  if ($emailUser) {
    // Authenticated TLS session (production).
    $mail->SMTPAuth   = true;
    $mail->Username   = $emailUser;
    $mail->Password   = getenv("EMAIL_PASS");
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = (int)(getenv("EMAIL_PORT") ?: 465);
  } else {
    // Unauthenticated plain SMTP (mailhog / local dev).
    $mail->SMTPAuth   = false;
    $mail->SMTPSecure = '';
    $mail->Port       = (int)(getenv("EMAIL_PORT") ?: 1025);
  }
  $mail->setFrom(getenv("EMAIL_FROM") ?: "noreply@localhost");                     

  return $mail;
}

?>