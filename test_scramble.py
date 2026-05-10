import random
_SCRAMBLE_MOVES=['U', 'Ui', 'U2', 'D', 'Di', 'D2', 'R', 'Ri', 'R2', 'L', 'Li', 'L2', 'F', 'Fi', 'F2', 'B', 'Bi', 'B2']
def _scramble(n: int = 20) -> list:
    from rubik.cube import Cube
    c = Cube('UUUUUUUUULLLFFFRRRBBBLLLFFFRRRBBBLLLFFFRRRBBBDDDDDDDDD')
    last_base = None
    for _ in range(n):
        candidates = [m for m in _SCRAMBLE_MOVES if m.replace('i','').replace('2','') != last_base]
        move = random.choice(candidates)
        base = move[0]
        if '2' in move:
            getattr(c, base)()
            getattr(c, base)()
        elif 'i' in move:
            getattr(c, base + 'i')()
        else:
            getattr(c, base)()
        last_base = base
    s = c.flat_str()
    U = s[0:9]
    R = s[15:18] + s[27:30] + s[39:42]
    F = s[12:15] + s[24:27] + s[36:39]
    D = s[45:54]
    L = s[9:12] + s[21:24] + s[33:36]
    B = s[18:21] + s[30:33] + s[42:45]
    return list(U + R + F + D + L + B)

if __name__ == '__main__':
    state = _scramble(20)
    cube_str = ''.join(state)
    import kociemba
    print("Cube string:", cube_str)
    print("Solution:", kociemba.solve(cube_str))
