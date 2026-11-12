# Standard Library
import pathlib
import unittest.mock

# local repo modules
import file_utils


def test_discovery_skips_deleted_files_before_content_selection(tmp_path: pathlib.Path) -> None:
	"""Unstaged deletions must not crash hygiene checks that inspect file contents."""
	present_path = tmp_path / "present.md"
	present_path.write_text("header", encoding="utf-8")

	def has_header(relative_path: str) -> bool:
		contents = (tmp_path / relative_path).read_text(encoding="utf-8")
		has_marker = "header" in contents
		return has_marker

	with unittest.mock.patch.object(
		file_utils, "list_tracked_files", return_value=["present.md", "removed.md"]
	):
		paths = file_utils.discover_files(extra_filter=has_header, repo_root=str(tmp_path))

	assert paths == [str(present_path)]
