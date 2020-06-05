# Just Another Chatroom Project

## Objectives

- Common SDLC (Software Development Life Cycle) practices were used for this project:
  - Planning
  - Requirements
  - Design and Prototyping
  - Software Development
  - Testing
  - Deployment
  - Operations and Maintenance

## Planning

- Clients:
  - Project sponser: As this is a demo project, there is no project sponser
  - End users: In order to make the chat room to be tailored for a specific group of people, we will assume the chat topics are about eat related: Restaurants, Recipies, Drinks, ...
- Resources:
  - Production platform:
    - Glitch
    - Self-hosted home server with public domain name access
- Technology Stacks
  - Wireframe: Pencil project or Figma  (not decided yet)
  - UI Front-end: HTML, vanila javasctipt, CSS, Bootstrap
  - Backend: Node.js+Express, MongoDB+Mongoose
  - Test: Chai, Chai-http, Mocca, puppeteer

## Requirements

### Key features
- This is a web based app that can let user post a topic (or thread), to ask for opinions or raise questions
- Any user can add comments or provide answers to the post.
- Any user (other than the author himself) can press 'like' to the answer.

### User Stories
- Landing Page
  Featured dish of the day: Random pick of theme picture, with caption, brief, author
  When user click the picture, it will goto the recipe page of that dish

- Recipes
  - User can add new recipies. Requirements:
    - Main picture (min requirement on resolution)
    - Name of the dish
    - Materials List
      (may supply pictures)
    - Cooking Steps
      (may supply pictures)
    - Final pictures (limited 4)
    - video upload (phase 2)
  - Like post, recipe can also accept user comments and replies
  - Registered user can bookmark recipes

- On Main page
  **Render contents**
  API route: /api/posts Method: Get
  - Divide into two sections. First section shows the top most 3 discussed topics.
  - The second section shows the most recent 5 discussed topics.

  API route: /api/posts?key={search phrases} Method: Get
  - Search field to filter all post and replies by provided keyword

  **Navigation**
  - Click the post will go to "Post page"
  - Expandable tool kit icon, when clicked, allow user to login/register/edit account info

  API route: /api/posts?page={keyword} Method: Get
  - Navigation bar to go next/previous/first/last pages.
  
  **Form data**
  API route: /api/posts Method: Post
  - press 'New post' button to add new post. Form fields: title, text, author.
    DB fields: _id, text, author, created_on, last_update, replies(array that contains reply IDs)

  API route: /api/posts Method: Delete.
  - Owner of the post can delete the post and all the replies. Form field: _id

- On Post page
  API route: /api/replies/{post_id}. Method: Get
  - Display the post and all its associated replies in cronologic order (from most recent to old).
  - Side-bar for routes to
    - related posts (similar keywords on post title)
    - Go to main page

  API route: /api/replies/{post_id}?sort=likes Method: Get
  - User can sort replies by date(default) or by most likes

  API route: /api/replies/{post_id}?key={search phrases} Method: Get
  - There is a Search field which can be used to filter all replies (associated with this post only) by keyword

  API route: /api/replies/{post_id}. Method: Post
  - User can add new reply. Form fields: text, author
    DB fields: _id(reply_id), post_id, text, author, created_on, likes
  - Insert new reply to DB will also update the value of 'last_update' of the post collection.
  
  API route: /api/replies/{post_id}. Method: Put
  - press 'like' button on any reply will update the DB and increment the value of 'likes' by one
    Form field: _id(reply_id)

  API route: /api/replies/{post_id}. Method: Delete
  - Owner of the reply can delete it. Form field: _id(reply_id)
