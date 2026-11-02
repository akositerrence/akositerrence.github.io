# My Digital Outpost

I started this project in 2024 since web dev seemed interesting. Upon further research I learned how easy it was to just make a static HTML file and deploy it through Github.
  
Fast forward to today, and my vision for this website is to put in cool stuff I've done, so that in the future, I can look back and say 'damn, I did that'

## Gallery contrast

Add an optional numeric `contrast` field to a photo in `gallery/photos.json`:

```json
{
  "src": "./photos/110126.webp",
  "width": 4128,
  "height": 5504,
  "location": "Humpback Rocks, Virginia",
  "date": "11·01·26",
  "contrast": 0.8
}
```

The value applies to both the thumbnail and full-size lightbox image: `1` is neutral, `0.8` reduces contrast, and values above `1` increase it. Zero is also valid. Use a number, not a quoted string.

Omitting the field (or using an invalid or negative value) keeps the existing contrast defaults: `0.925` for thumbnails and `0.92` for the lightbox. Other image filters stay unchanged. Editing these values requires no image processing or CSS rebuild.
