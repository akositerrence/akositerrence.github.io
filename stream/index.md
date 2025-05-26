---
layout: default
title: Stream
permalink: /stream/
pagination:
  enabled: true
  per_page: 5
  path: '/stream/page/:num/'
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
  <nav class="pagination">
    {% if paginator.previous_page %}
      <a href="{{ paginator.previous_page_path | relative_url }}">&laquo; Newer</a>
    {% endif %}
    {% for page in (1..paginator.total_pages) %}
      {% if page == paginator.page %}
        <span class="current">{{ page }}</span>
      {% else %}
        <a href="{{ paginator.paginate_path | replace: ':num', page | relative_url }}">{{ page }}</a>
      {% endif %}
    {% endfor %}
    {% if paginator.next_page %}
      <a href="{{ paginator.next_page_path | relative_url }}">Older &raquo;</a>
    {% endif %}
  </nav>
{% endif %}
