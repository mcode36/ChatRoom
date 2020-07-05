# Test items

## Functional Test

- Suite : Login
  - route: /api/login
    - (Session) When logout, goto home page and click 'Enter' button
      expect: go to /api/login page

    - No email entered then submit
      expect: "Please fill out this field" (HTML5 input required)
    - Only enter email then submit
      expect: "Please fill out this field" (HTML5 input required)
    - Wrong email address entered then submit
      expect: pop up alert on client
    - Correct email address but wrong password submitted
      expect: pop up alert on client
    - Both email and password correct
      expect: be redirected to /api/posts page
    
    - (Session) after valid login, goto home page and click 'Enter' button
      expect: go to /api/posts page directly (instead of going to /api/login)
      
      

- Suite : Password reset
  - route: http://localhost:3000/api/passwd_reset_req
    - form submit with email address not in DB
      expect: be redirected back as http://localhost:3000/api/passwd_reset_req?rcode=3

    - form submit with valid email address
      expect: be redirected to /api/passwd_reset page

  - route: http://localhost:3000/api/passwd_reset
    - send wrong password reset code
      expect: pop up alert on client
    - send correct password reset code
      expect: be redirected to /api/account page
	  