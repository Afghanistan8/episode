"""What bytes are, read off the bytes. R-EXH-1."""

import helpers


def test_png_with_the_full_signature_is_a_scene_frame(ep):
    assert ep.sniff_media(helpers.png()) == ep.MEDIA_PNG
    assert ep.exhibit_kind_for(ep.MEDIA_PNG) == ep.EX_FRAME


def test_jfif_jpeg_is_a_scene_frame(ep):
    assert ep.sniff_media(helpers.jpeg()) == ep.MEDIA_JPEG
    assert ep.exhibit_kind_for(ep.MEDIA_JPEG) == ep.EX_FRAME


def test_a_truncated_png_signature_is_not_a_frame(ep):
    nearly = b"\x89PNG\r\n\x1a" + b"\x00" * 32
    assert ep.sniff_media(nearly) == ep.MEDIA_OTHER
    assert ep.exhibit_kind_for(ep.sniff_media(nearly)) == ep.EX_PAPER


def test_a_jpeg_without_the_jfif_header_is_paperwork(ep):
    # Episode asks for a JFIF header and means it. An Exif frame can still be
    # read as a document; it cannot carry the scene.
    assert ep.sniff_media(helpers.exif_jpeg()) == ep.MEDIA_OTHER
    assert ep.exhibit_kind_for(ep.sniff_media(helpers.exif_jpeg())) == ep.EX_PAPER


def test_a_pdf_is_paperwork(ep):
    assert ep.sniff_media(helpers.pdf()) == ep.MEDIA_OTHER


def test_paperwork_can_still_be_read_as_an_image(ep):
    # Wider than the frame test on purpose: a photographed bill of lading is
    # worth transcribing even though it grounds nothing. R-GRD-2.
    assert ep.looks_like_image(helpers.exif_jpeg())
    assert not ep.looks_like_image(helpers.pdf())


def test_the_digest_is_over_the_whole_blob(ep):
    assert ep.sha256_hex(b"") == (
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
    assert ep.sha256_hex(helpers.png(b"a")) != ep.sha256_hex(helpers.png(b"b"))
