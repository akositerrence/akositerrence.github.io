---
layout: default
title:  Stream
permalink: /stream/
paginate: 5
paginate_path: "/stream/page:num"
---

<h1>{{ page.title }}</h1>
<ul>
  {% for post in paginator.posts %}
    <li>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      <small>{{ post.date | date: "%b %-d, %Y" }}</small>
    </li>
  {% endfor %}
</ul>
{% if paginator.total_pages > 1 %}
<nav>
  {% if paginator.previous_page %}
    <a href="{{ paginator.previous_page_path | relative_url }}">&laquo; Newer</a>
  {% endif %}
  {% if paginator.next_page %}
    <a href="{{ paginator.next_page_path | relative_url }}">Older &raquo;</a>
  {% endif %}
</nav>
{% endif %}