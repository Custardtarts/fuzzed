#include "FuzzTreeTransform.h"
#include "TransformUtil.h"

int main(int argc, char **argv)
{
	if (argc < 2) EXIT_ERROR("Too few arguments. Please specify a filename.");

	const std::string fileName(argv[1]);
	auto fttransform = FuzzTreeTransform(fileName);

	for (auto tree : fttransform.transform())
	{
	}
}