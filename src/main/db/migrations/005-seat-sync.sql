INSERT OR IGNORE INTO seat (seat_id, classroom_layout_id, element_id, seat_code, is_active, auto_position_tags_json)
SELECT element_id, classroom_layout_id, element_id, element_id, 1, '{}'
FROM classroom_element
WHERE element_type = 'desk';
